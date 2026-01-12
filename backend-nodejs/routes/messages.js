/* eslint-env node */
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { all } = require('../config/database');

let { JWT_SECRET } = (() => {
  try { return require('../config/auth'); }
  catch { return {}; }
})();
JWT_SECRET = JWT_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required (set env JWT_SECRET)');
}

const router = express.Router();

/* ---------- RATE LIMIT (simple in-memory) ---------- */
const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15_000);
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 60);
const rateCounters = new Map();
const rateLimit = (req, res, next) => {
  const key = `${req.ip}:${req.userId || 'anon'}`;
  const now = Date.now();
  const entry = rateCounters.get(key) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateCounters.set(key, entry);
  if (entry.count > RATE_MAX) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  return next();
};

/* ---------- AUTH MIDDLEWARE ---------- */
const authenticateToken = (req, res, next) => {
  const raw = req.headers.authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    if (!req.userId) return res.status(401).json({ error: 'Invalid token' });
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

router.use(authenticateToken);
router.use(rateLimit);

/* ---------- UPLOAD CONFIG ---------- */
const resolveUploadDir = (value) =>
  value ? (path.isAbsolute(value) ? value : path.resolve(process.cwd(), value)) : path.resolve(process.cwd(), 'uploads');
const uploadDir = resolveUploadDir(process.env.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const buildFileUrl = (req, filename) => {
  if (!filename) return null;
  if (process.env.CDN_BASE_URL) {
    return `${process.env.CDN_BASE_URL.replace(/\/+$/, '')}/uploads/${filename}`;
  }
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
};

/* ---------- HELPERS ---------- */
const SUPPORT_TOKEN = process.env.SUPPORT_CHAT_TOKEN || 'gazavba_support_chat';

/**
 * Vérifie si l'utilisateur est dans le chat
 * - 1-to-1 : user1Id ou user2Id
 * - Groupe : chat_participants
 */
async function userInChat(chatId, userId) {
  const chat = await Chat.getById(chatId);
  if (!chat) return false;
  if (chat.type === 'direct') {
    return chat.user1Id === userId || chat.user2Id === userId;
  }
  const rows = await all(
    `SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ? LIMIT 1`,
    [chatId, userId]
  );
  return rows.length > 0;
}

const validateSendPayload = (body = {}) => {
  const errors = [];
  if (!body.chatId || typeof body.chatId !== 'string') errors.push('chatId is required');
  if (!body.text && !body.mediaUrl) errors.push('text or mediaUrl is required');
  if (body.text && typeof body.text !== 'string') errors.push('text must be string');
  if (body.mediaUrl && typeof body.mediaUrl !== 'string') errors.push('mediaUrl must be string');
  if (body.mediaName && typeof body.mediaName !== 'string') errors.push('mediaName must be string');
  if (body.clientId && typeof body.clientId !== 'string') errors.push('clientId must be string');
  return errors;
};

/* ---------- ROUTES ---------- */

// GET /api/messages/chat/:chatId → Liste des messages (SÉCURISÉE)
router.get('/chat/:chatId', async (req, res) => {
  try {
    let { chatId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = req.query.before || null;

    // Support chat token
    if (String(chatId) === SUPPORT_TOKEN) {
      const rows = await all(
        `SELECT id FROM chats WHERE type='group' AND (name = ? OR name = ?) LIMIT 1`,
        [process.env.SUPPORT_CHAT_NAME || 'Gazavba Support', 'Support']
      );
      if (!rows.length) return res.status(404).json({ error: 'Support chat not found' });
      chatId = rows[0].id;
    }

    if (!(await userInChat(chatId, req.userId))) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const messages = await Message.getByChatId(chatId, req.userId, limit, before);

    // Marquer comme lus automatiquement
    const unreadIds = messages
      .filter(m => m.receiverId === req.userId && !m.readAt)
      .map(m => m.id);

    const readAt = new Date().toISOString();
    if (unreadIds.length > 0) {
      await Message.markAsReadBatch(unreadIds, req.userId);
    }
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('chat_read', { chatId, userId: req.userId, readAt });
    }

    res.json({ messages });
  } catch (e) {
    console.error('Get messages error:', e);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages → Envoyer un message
router.post('/', async (req, res) => {
  try {
    let { chatId, clientId, text, messageType = 'text', mediaUrl, mediaName } = req.body;
    const validationErrors = validateSendPayload({ chatId, text, mediaUrl, mediaName, clientId });
    if (validationErrors.length) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', details: validationErrors });
    }

    // Support chat token
    if (String(chatId) === SUPPORT_TOKEN) {
      const rows = await all(
        `SELECT id FROM chats WHERE type='group' AND (name = ? OR name = ?) LIMIT 1`,
        [process.env.SUPPORT_CHAT_NAME || 'Gazavba Support', 'Support']
      );
      if (rows.length) chatId = rows[0].id;
    }

    const chat = await Chat.getById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Vérifier participation
    if (chat.type === 'direct') {
      if (chat.user1Id !== req.userId && chat.user2Id !== req.userId) {
        return res.status(403).json({ error: 'NOT_IN_CHAT' });
      }
    } else {
      if (!(await userInChat(chatId, req.userId))) {
        // Auto-join support chat
        if (chat.name?.includes('Support')) {
          await Chat.addParticipants(chatId, [req.userId]);
        } else {
          return res.status(403).json({ error: 'NOT_IN_CHAT' });
        }
      }
    }

    const message = await Message.create({
      chatId,
      senderId: req.userId,
      text: text?.trim() || null,
      messageType,
      mediaUrl: mediaUrl || null,
      mediaName: mediaName || null,
      clientId: clientId || null,
    });

    // Émettre via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('new_message', message);
      io.to(`chat_${chatId}`).emit('message_new', message);
    }

    res.status(201).json(message);
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ error: e.message || 'Failed to send message' });
  }
});

// POST /api/messages/upload → Upload fichier
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = buildFileUrl(req, req.file.filename);
    res.json({
      url,
      path: `/uploads/${req.file.filename}`,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Failed to upload' });
  }
});

// POST /api/messages/:messageId/read → Marquer un message comme lu
router.post('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.getById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.receiverId !== req.userId) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const readAt = new Date().toISOString();
    await Message.markAsReadBatch([messageId], req.userId);
    const io = req.app.get('io');
    if (io) io.to(`chat_${message.chatId}`).emit('message_read', { messageId, userId: req.userId, chatId: message.chatId, readAt });
    res.json({ ok: true });
  } catch (e) {
    console.error('Mark read error:', e);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// GET /api/messages/chat/:chatId/unread → Compter non lus
router.get('/chat/:chatId/unread', async (req, res) => {
  try {
    let { chatId } = req.params;
    if (String(chatId) === SUPPORT_TOKEN) {
      const rows = await all(
        `SELECT id FROM chats WHERE type='group' AND (name = ? OR name = ?) LIMIT 1`,
        [process.env.SUPPORT_CHAT_NAME || 'Gazavba Support', 'Support']
      );
      if (rows.length) chatId = rows[0].id;
    }
    if (!(await userInChat(chatId, req.userId))) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const count = await Message.getUnreadCount(chatId, req.userId);
    res.json({ unreadCount: count });
  } catch (e) {
    console.error('Unread count error:', e);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// DELETE /api/messages/:messageId → Supprimer
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.getById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== req.userId) {
      return res.status(403).json({ error: 'CANNOT_DELETE' });
    }
    await Message.delete(messageId);
    const io = req.app.get('io');
    if (io) io.to(`chat_${message.chatId}`).emit('message_deleted', { messageId });
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete message error:', e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /api/messages/chat/:chatId/read → Marquer tout le chat comme lu
router.post('/chat/:chatId/read', async (req, res) => {
  try {
    let { chatId } = req.params;
    if (String(chatId) === SUPPORT_TOKEN) {
      const rows = await all(
        `SELECT id FROM chats WHERE type='group' AND (name = ? OR name = ?) LIMIT 1`,
        [process.env.SUPPORT_CHAT_NAME || 'Gazavba Support', 'Support']
      );
      if (rows.length) chatId = rows[0].id;
    }
    if (!(await userInChat(chatId, req.userId))) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const messages = await Message.getByChatId(chatId, req.userId, 1000);
    const unreadIds = messages
      .filter(m => m.receiverId === req.userId && !m.readAt)
      .map(m => m.id);
    const readAt = new Date().toISOString();
    if (unreadIds.length > 0) {
      await Message.markAsReadBatch(unreadIds, req.userId);
    }
    const io = req.app.get('io');
    if (io) io.to(`chat_${chatId}`).emit('chat_read', { chatId, userId: req.userId, readAt });
    res.json({ ok: true, marked: unreadIds.length });
  } catch (e) {
    console.error('Mark chat read error:', e);
    res.status(500).json({ error: 'Failed to mark chat as read' });
  }
});

module.exports = router;
