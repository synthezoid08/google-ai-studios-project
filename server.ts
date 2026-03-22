import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aether_default_secret_2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin_secure_password_2026';

// Database Setup
const db = new Database('aether.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create default admin if not exists
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get(ADMIN_USERNAME);
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(ADMIN_USERNAME, hashedPassword, 'admin');
}

// In-memory message store (Ephemeral)
let messages: any[] = [];
let activeConnections = new Map<number, WebSocket>();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      // Check if user is still active
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.id);
      if (!user) return res.status(401).json({ error: 'Account disabled' });
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if ((req as any).user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  // API Routes
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    res.json((req as any).user);
  });

  // Admin Routes
  app.get('/api/admin/users', authenticate, isAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, role, is_active, created_at FROM users').all();
    res.json(users);
  });

  app.post('/api/admin/users', authenticate, isAdmin, (req, res) => {
    const { username, password, role } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, role || 'user');
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
    const { is_active } = req.body;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/admin/users/:id', authenticate, isAdmin, (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/admin/messages', authenticate, isAdmin, (req, res) => {
    messages = [];
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'CLEAR_MESSAGES' }));
      }
    });
    res.json({ success: true });
  });

  app.get('/api/admin/messages', authenticate, isAdmin, (req, res) => {
    res.json(messages);
  });

  // WebSocket Logic
  wss.on('connection', (ws, req) => {
    const cookies = req.headers.cookie;
    if (!cookies) return ws.close();
    
    const token = cookies.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];
    if (!token) return ws.close();

    try {
      const user = jwt.verify(token, JWT_SECRET) as any;
      activeConnections.set(user.id, ws);

      ws.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        
        if (payload.type === 'MESSAGE') {
          const msg = {
            id: Date.now(),
            senderId: user.id,
            senderName: user.username,
            content: payload.content, // Encrypted content from client
            timestamp: new Date().toISOString()
          };
          messages.push(msg);
          
          // Broadcast to all
          const broadcastMsg = JSON.stringify({ type: 'MESSAGE', data: msg });
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastMsg);
            }
          });
        }
      });

      ws.on('close', () => {
        activeConnections.delete(user.id);
      });

    } catch (e) {
      ws.close();
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Aether Server running on http://localhost:${PORT}`);
  });
}

startServer();
