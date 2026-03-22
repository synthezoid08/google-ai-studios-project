/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Lock, 
  Send, 
  Trash2, 
  Users, 
  LogOut, 
  Terminal, 
  Activity, 
  UserPlus, 
  UserMinus,
  MessageSquare,
  Settings,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  is_active: number;
  created_at?: string;
}

interface Message {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: string;
}

// --- Components ---

const FuturisticButton = ({ children, onClick, variant = 'primary', className, disabled }: any) => {
  const variants = {
    primary: "border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10",
    danger: "border-red-500/50 text-red-400 hover:bg-red-500/10",
    ghost: "border-zinc-800 text-zinc-400 hover:bg-zinc-800/50"
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative px-4 py-2 border transition-all duration-300 uppercase tracking-widest text-xs font-mono disabled:opacity-50",
        variants[variant as keyof typeof variants],
        className
      )}
    >
      <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-current" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-current" />
      {children}
    </button>
  );
};

const FuturisticInput = ({ label, type = 'text', value, onChange, placeholder, icon: Icon }: any) => (
  <div className="space-y-1">
    {label && <label className="text-[10px] uppercase tracking-tighter text-zinc-500 font-mono">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "w-full bg-zinc-900/50 border border-zinc-800 px-4 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50 transition-colors",
          Icon && "pl-10"
        )}
      />
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'chat' | 'admin'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && !ws) {
      connectWs();
    }
    return () => {
      ws?.close();
    };
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setView('chat');
      }
    } catch (e) {}
    setLoading(false);
  };

  const connectWs = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'MESSAGE') {
        setMessages(prev => [...prev, payload.data]);
      } else if (payload.type === 'CLEAR_MESSAGES') {
        setMessages([]);
      }
    };

    socket.onclose = () => {
      if (user) setTimeout(connectWs, 3000);
    };

    setWs(socket);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setView('chat');
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Connection failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setWs(null);
    setMessages([]);
    setView('login');
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !ws) return;
    ws.send(JSON.stringify({ type: 'MESSAGE', content: newMessage }));
    setNewMessage('');
  };

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', password: '', role: 'user' });

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserData)
    });
    if (res.ok) {
      setShowAddUser(false);
      setNewUserData({ username: '', password: '', role: 'user' });
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const toggleUserStatus = async (id: number, currentStatus: number) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: currentStatus === 1 ? 0 : 1 })
    });
    fetchUsers();
  };

  const deleteMessages = async () => {
    await fetch('/api/admin/messages', { method: 'DELETE' });
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-black">
      <div className="text-emerald-500 font-mono animate-pulse tracking-widest">INITIALIZING_AETHER_CORE...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-zinc-300 selection:bg-emerald-500/30">
      <div className="scanline" />
      
      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-16 border-b border-zinc-800 bg-black/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-emerald-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tighter text-white uppercase">Aether</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Secure_Node_Active</span>
            </div>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-mono text-zinc-400">{user.username}</span>
              <span className="text-[9px] uppercase tracking-widest text-emerald-500">{user.role}</span>
            </div>
            {user.role === 'admin' && (
              <button 
                onClick={() => {
                  setView(view === 'admin' ? 'chat' : 'admin');
                  if (view !== 'admin') fetchUsers();
                }}
                className={cn(
                  "p-2 border transition-colors",
                  view === 'admin' ? "border-emerald-500 text-emerald-500" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleLogout} className="p-2 border border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/50 transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      <main className="pt-24 pb-8 px-4 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.div 
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <div className="p-8 border border-zinc-800 bg-zinc-900/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                
                <div className="text-center mb-8">
                  <Lock className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight">Authentication Required</h2>
                  <p className="text-xs text-zinc-500 mt-2 font-mono">ENCRYPTED_SESSION_INITIALIZATION</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <FuturisticInput 
                    label="Access Identifier"
                    icon={Terminal}
                    value={username}
                    onChange={(e: any) => setUsername(e.target.value)}
                    placeholder="USERNAME"
                  />
                  <FuturisticInput 
                    label="Security Key"
                    type="password"
                    icon={Lock}
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    placeholder="PASSWORD"
                  />
                  
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-mono bg-red-500/10 p-3 border border-red-500/20">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <FuturisticButton className="w-full py-3">
                    Establish Connection
                  </FuturisticButton>
                </form>

                <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
                  <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                    Unauthorized access is strictly prohibited. <br/> All actions are logged.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[calc(100vh-12rem)] flex flex-col border border-zinc-800 bg-zinc-900/10"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Secure_Channel_01</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-500/50">E2EE_ACTIVE</div>
              </div>

              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
              >
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                    <Activity className="w-12 h-12 mb-4 animate-pulse" />
                    <p className="text-xs font-mono uppercase tracking-widest">Waiting for transmissions...</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      msg.senderId === user?.id ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-zinc-500">{msg.senderName}</span>
                      <span className="text-[9px] text-zinc-700">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className={cn(
                      "px-4 py-2 text-sm font-mono border",
                      msg.senderId === user?.id 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-100" 
                        : "bg-zinc-900/50 border-zinc-800 text-zinc-300"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Enter transmission..."
                    className="flex-1 bg-black border border-zinc-800 px-4 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                  <button 
                    onClick={sendMessage}
                    className="p-2 bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats */}
                <div className="p-6 border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <Users className="w-5 h-5 text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Users</span>
                  </div>
                  <div className="text-3xl font-bold text-white font-mono">{users.length}</div>
                </div>
                <div className="p-6 border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Active Messages</span>
                  </div>
                  <div className="text-3xl font-bold text-white font-mono">{messages.length}</div>
                </div>
                <div className="p-6 border border-zinc-800 bg-zinc-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Security Status</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-500 font-mono uppercase">Optimal</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Management */}
                <div className="border border-zinc-800 bg-zinc-900/10">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-white">User_Registry</h3>
                    <FuturisticButton 
                      variant="ghost" 
                      className="py-1 px-2"
                      onClick={() => setShowAddUser(true)}
                    >
                      <UserPlus className="w-3 h-3 mr-2" /> New
                    </FuturisticButton>
                  </div>

                  <AnimatePresence>
                    {showAddUser && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-b border-zinc-800 bg-emerald-500/5"
                      >
                        <form onSubmit={handleCreateUser} className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FuturisticInput 
                              placeholder="USERNAME"
                              value={newUserData.username}
                              onChange={(e: any) => setNewUserData({...newUserData, username: e.target.value})}
                            />
                            <FuturisticInput 
                              placeholder="PASSWORD"
                              type="password"
                              value={newUserData.password}
                              onChange={(e: any) => setNewUserData({...newUserData, password: e.target.value})}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <select 
                              className="bg-black border border-zinc-800 text-[10px] font-mono p-1 uppercase"
                              value={newUserData.role}
                              onChange={(e) => setNewUserData({...newUserData, role: e.target.value})}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                            <div className="flex gap-2">
                              <FuturisticButton variant="ghost" onClick={() => setShowAddUser(false)}>Cancel</FuturisticButton>
                              <FuturisticButton type="submit">Create</FuturisticButton>
                            </div>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="divide-y divide-zinc-800/50">
                    {users.map(u => (
                      <div key={u.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                        <div>
                          <div className="text-sm font-mono text-zinc-300">{u.username}</div>
                          <div className="text-[9px] uppercase text-zinc-500">{u.role}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleUserStatus(u.id, u.is_active)}
                            className={cn(
                              "text-[10px] font-mono px-2 py-1 border uppercase",
                              u.is_active ? "border-emerald-500/30 text-emerald-500" : "border-red-500/30 text-red-500"
                            )}
                          >
                            {u.is_active ? 'Active' : 'Disabled'}
                          </button>
                          {u.username !== 'admin' && (
                            <button className="p-1 text-zinc-600 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Controls */}
                <div className="border border-zinc-800 bg-zinc-900/10">
                  <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-white">System_Directives</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">Global Message Purge</h4>
                      <p className="text-xs text-zinc-400 mb-4">Remotely delete all messages from all active sessions instantly.</p>
                      <FuturisticButton 
                        variant="danger" 
                        className="w-full"
                        onClick={deleteMessages}
                      >
                        Execute Global Purge
                      </FuturisticButton>
                    </div>
                    
                    <div className="pt-6 border-t border-zinc-800">
                      <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">Network Lockdown</h4>
                      <p className="text-xs text-zinc-400 mb-4">Disable all non-admin access to the Aether network.</p>
                      <FuturisticButton variant="ghost" className="w-full">
                        Initiate Lockdown
                      </FuturisticButton>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-4 left-6 text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em] pointer-events-none">
        Aether_Protocol_v2.0.26 // Encrypted_Stream_Active
      </footer>
    </div>
  );
}
