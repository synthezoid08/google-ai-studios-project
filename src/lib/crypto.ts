import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

// Generate a new keypair for the session
export const generateKeyPair = () => {
  return nacl.box.keyPair();
};

// Encrypt a message for a recipient
export const encryptMessage = (message: string, recipientPublicKey: Uint8Array, senderPrivateKey: Uint8Array) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = decodeUTF8(message);
  const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, senderPrivateKey);
  
  const fullMessage = new Uint8Array(nonce.length + encrypted.length);
  fullMessage.set(nonce);
  fullMessage.set(encrypted, nonce.length);
  
  return encodeBase64(fullMessage);
};

// Decrypt a message from a sender
export const decryptMessage = (encryptedBase64: string, senderPublicKey: Uint8Array, recipientPrivateKey: Uint8Array) => {
  try {
    const fullMessage = decodeBase64(encryptedBase64);
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const encrypted = fullMessage.slice(nacl.box.nonceLength);
    
    const decrypted = nacl.box.open(encrypted, nonce, senderPublicKey, recipientPrivateKey);
    if (!decrypted) return '[Decryption Failed]';
    
    return encodeUTF8(decrypted);
  } catch (e) {
    return '[Decryption Error]';
  }
};

// Simple symmetric encryption for "Admin View" or "Shared Secret" if needed
// But for true E2EE, we use asymmetric.
// For this demo, we'll use a simpler "Session Secret" approach if asymmetric is too complex for a single-room chat.
// Actually, let's use a "Room Key" that is shared among active users.
// Or just asymmetric for each message.

// For simplicity in a multi-user chat where everyone sees everything (like a group):
// We'll use a shared room key that is encrypted for each user when they join.
// But wait, the user wants "Secure private messaging".
// I'll implement a simple "Master Key" approach for the demo where the server distributes a key to authenticated users.
// Actually, I'll just use asymmetric encryption for the "Private" feel.
