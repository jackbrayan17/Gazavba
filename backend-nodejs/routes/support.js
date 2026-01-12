/* eslint-env node */
const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat'); // doit exposer create + addParticipant + getParticipants + getById (voir helpers ci-dessous)
const { JWT_SECRET } = require('../config/auth');

const router = express.Router();

/* ===================== AUTH MIDDLEWARE ===================== */

// Auth par API Key (machine-to-machine)
function supportApiKeyAuth(req) {
  const apiKey = req.headers['x-support-api-key'] || req.headers['x-api-key'];
  const expected = process.env.SUPPORT_API_KEY;
  return expected && apiKey && apiKey === expected;
}

// Auth par JWT d'un user Support
function jwtSupportAuth(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // on laisse passer si le token est valide; on vérifiera le rôle après
    return decoded?.userId || null;
  } catch (_e) {
    return null;
  }
}

async function loadUser(userId) {
  if (!userId) return null;
  try {
    return await User.getById(userId);
  } catch {
    return null;
  }
}

// Auth hybride: API Key OU JWT d’un user support.
// À la fin, req.supportUser contient l’utilisateur "support" (persisté) OU un user synthétique (service account).
async function authenticateSupport(req, res, next) {
  // 1) API Key => compte service
  if (supportApiKeyAuth(req)) {
    // on autorise un "service account" virtuel si SUPPORT_USER_ID n'existe pas en base
    const supportUserId = process.env.SUPPORT_USER_ID || 'gazavba_support';
    const fallback = {
      id: supportUserId,
      name: 'Gazavba Support',
      email: 'support@gazavba.com',
      phone: '',
      avatar: process.env.SUPPORT_AVATAR || 'https://gazavba.eeuez.com/assets/support-avatar.png',
      isOnline: true,
      isVerified: true,
      isSupport: true,
      role: 'support',
      lastSeen: new Date().toISOString(),
    };
    const dbUser = await loadUser(supportUserId);
    req.supportUser = dbUser
      ? { ...dbUser, isSupport: !!dbUser.isSupport || dbUser.role === 'support', role: dbUser.role || 'support' }
      : fallback;
    return next();
  }

  // 2) JWT support user
  const userId = jwtSupportAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized (support)' });

  const user = await loadUser(userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized (user not found)' });

  const isSupport = !!user.isSupport || user.role === 'support';
  if (!isSupport) return res.status(403).json({ error: 'Forbidden (not a support user)' });

  req.supportUser = { ...user, isSupport: true, role: user.role || 'support' };
  return next();
}

/* ===================== HELPERS ===================== */

// Retour JSON standard pour le compte Support (UI providers)
function buildSupportPublicProfile() {
  return {
    id: process.env.SUPPORT_USER_ID || 'gazavba_support',
    name: 'Gazavba Support',
    phone: '',
    email: 'support@gazavba.com',
    avatar: process.env.SUPPORT_AVATAR || 'https://gazavba.eeuez.com/assets/support-avatar.png',
    isOnline: true,
    isVerified: true,
    isSupport: true,
    role: 'support',
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Trouver/Créer un chat direct entre support et userId
async function ensureDirectChat(supportUserId, otherUserId) {
  // On tente de trouver un chat "direct" existant via Chat model
  if (typeof Chat.getDirectChatBetween === 'function') {
    const existing = await Chat.getDirectChatBetween(supportUserId, otherUserId);
    if (existing) return existing.id;
  }

  // fallback générique avec Chat.create + addParticipant
  let chat = null;
  if (typeof Chat.findDirectBetween === 'function') {
    chat = await Chat.findDirectBetween(supportUserId, otherUserId);
    if (chat?.id) return chat.id;
  }

  // create direct chat
  const created =
    typeof Chat.create === 'function'
      ? await Chat.create({
          type: 'direct',
          name: null,
          createdBy: supportUserId,
        })
      : null;

  const chatId = created?.id;
  if (!chatId) throw new Error('Failed to create direct chat');

  if (typeof Chat.addParticipant === 'function') {
    await Chat.addParticipant(chatId, supportUserId);
    await Chat.addParticipant(chatId, otherUserId);
  } else if (typeof Chat.addParticipants === 'function') {
    await Chat.addParticipants(chatId, [supportUserId, otherUserId]);
  } else {
    throw new Error('Chat model must implement addParticipant(s)');
  }

  return chatId;
}

// Construit le record message pour API (ajoute alias content/createdAt et méta sender support)
function decorateSentMessage(record, sender) {
  return {
    ...record,
    content: record.text,
    createdAt: record.createdAt || record.timestamp,
    senderName: sender?.name || 'Gazavba Support',
    senderAvatar: sender?.avatar || process.env.SUPPORT_AVATAR || null,
    senderRole: sender?.role || 'support',
    senderIsSupport: true,
  };
}

/* ===================== PUBLIC (GET) ===================== */

// Compte Support (lecture)
router.get('/account', (_req, res) => {
  res.json({ user: buildSupportPublicProfile() });
});

// Message d’accueil (lecture)
router.get('/welcome-message', (_req, res) => {
  const message =
    process.env.SUPPORT_WELCOME_MESSAGE ||
    `Welcome to Gazavba! 👋

I'm here to help with anything you need:
• Getting started
• Account setup
• Technical support
• Billing
• Feature requests

How can I assist you today?`;
  res.json({ message });
});

/* ===================== WRITE APIs (require support auth) ===================== */

// Envoyer un message du support (vers chatId OU vers userId)
// Body: { chatId?: string, userId?: string, text?: string, content?: string, messageType?: string, mediaUrl?: string, mediaName?: string }
router.post('/messages', authenticateSupport, async (req, res) => {
  try {
    const sender = req.supportUser;
    const {
      chatId: rawChatId,
      userId: rawUserId,
      text,
      content,
      messageType = 'text',
      mediaUrl = null,
      mediaName = null,
    } = req.body || {};

    if (!rawChatId && !rawUserId) {
      return res.status(400).json({ error: 'Provide chatId or userId' });
    }

    let chatId = rawChatId;
    if (!chatId && rawUserId) {
      // direct chat support <-> user
      chatId = await ensureDirectChat(sender.id, String(rawUserId));
    }

    const payload = {
      chatId,
      senderId: sender.id,
      text: text ?? content ?? '',
      messageType,
      mediaUrl,
      mediaName,
    };

    if (!payload.text && !payload.mediaUrl) {
      return res.status(400).json({ error: 'Provide text/content or mediaUrl' });
    }

    const record = await Message.create(payload);
    const decorated = decorateSentMessage(record, sender);

    // Optionnel: notifier via Socket.IO si vous exposez io globalement
    try {
      const io = req.app.get('io'); // dans server.js: app.set('io', io);
      if (io) {
        // notifier tous les participants du chat
        const participants = await (Chat.getParticipants ? Chat.getParticipants(chatId) : []);
        for (const p of participants) {
          io.to(`user_${p.userId}`).emit('new_message', {
            message: decorated,
            chatId,
            senderId: sender.id,
            chatName: null,
          });
        }
        io.to(`chat_${chatId}`).emit('message_new', { message: decorated, chatId });
      }
    } catch (_e) {
      // silencieux
    }

    res.status(201).json({ message: decorated });
  } catch (e) {
    console.error('Support send message error:', e);
    res.status(500).json({ error: 'Failed to send support message' });
  }
});

// Broadcast support → plusieurs userIds (création auto des chats directs)
// Body: { userIds: string[], text?: string, content?: string, messageType?: string, mediaUrl?: string, mediaName?: string }
router.post('/messages/batch', authenticateSupport, async (req, res) => {
  try {
    const sender = req.supportUser;
    const { userIds, text, content, messageType = 'text', mediaUrl = null, mediaName = null } = req.body || {};

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array required' });
    }
    if (!text && !content && !mediaUrl) {
      return res.status(400).json({ error: 'Provide text/content or mediaUrl' });
    }

    const results = [];
    for (const uidRaw of userIds) {
      const uid = String(uidRaw);
      const chatId = await ensureDirectChat(sender.id, uid);
      const record = await Message.create({
        chatId,
        senderId: sender.id,
        text: text ?? content ?? '',
        messageType,
        mediaUrl,
        mediaName,
      });
      const decorated = decorateSentMessage(record, sender);
      results.push({ userId: uid, chatId, message: decorated });

      // socket notification (optionnel)
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${uid}`).emit('new_message', {
            message: decorated,
            chatId,
            senderId: sender.id,
            chatName: null,
          });
          io.to(`chat_${chatId}`).emit('message_new', { message: decorated, chatId });
        }
      } catch (_e) {}
    }

    res.status(201).json({ results });
  } catch (e) {
    console.error('Support broadcast error:', e);
    res.status(500).json({ error: 'Failed to broadcast support messages' });
  }
});

// (Facultatif) Définir/mettre à jour le message d’accueil (stockage simple en mémoire/env)
// Body: { message: string }
router.post('/welcome-message', authenticateSupport, async (req, res) => {
  try {
    const msg = (req.body?.message || '').toString().trim();
    if (!msg) return res.status(400).json({ error: 'message required' });

    // Vous pouvez stocker en base si vous avez une table settings.
    // Ici on passe par une variable process (volatile, mais simple).
    process.env.SUPPORT_WELCOME_MESSAGE = msg;
    res.json({ ok: true, message: msg });
  } catch (e) {
    console.error('Support set welcome message error:', e);
    res.status(500).json({ error: 'Failed to set welcome message' });
  }
});

module.exports = router;
