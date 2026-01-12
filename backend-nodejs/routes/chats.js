/* eslint-env node */
const express = require('express');
const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const { all, run } = require('../config/database');
const { cache } = require('../config/cache');
const { v4: uuidv4 } = require('uuid');

let JWT_SECRET = process.env.JWT_SECRET;
try { ({ JWT_SECRET } = require('../config/auth')); } catch { }

/* ==================== ROUTER ==================== */
const router = express.Router();

/* ==================== AUTH MIDDLEWARE ==================== */
const authenticateToken = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET || 'dev_secret_change_me');
    req.userId = decoded.userId || decoded.id;
    if (!req.userId) throw new Error();
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
router.use(authenticateToken);

/* ==================== CONSTANTS ==================== */
const SUPPORT_TOKEN = process.env.SUPPORT_CHAT_TOKEN || 'gazavba_support_chat';

/* ==================== HELPERS ==================== */
const onlyUnique = arr => Array.from(new Set((arr || []).map(String).filter(Boolean)));

/* ==================== PATCH /users/me/background - Set Global Background ==================== */
router.patch('/users/me/background', async (req, res) => {
  try {
    const { background } = req.body;
    if (typeof background !== 'string') {
      return res.status(400).json({ error: 'background must be a string' });
    }

    await run(`UPDATE users SET backgroundGlobal = ? WHERE id = ?`, [background, req.userId]);
    await cache.invalidateAllChats(req.userId); // Affects all chat list views

    res.json({ ok: true, background });
  } catch (e) {
    console.error('Set global background error:', e);
    res.status(500).json({ error: 'Failed to set global background' });
  }
});

/* ==================== PATCH /:id/background - Set Per-Chat Background ==================== */
router.patch('/:id/background', async (req, res) => {
  try {
    const { background } = req.body;
    if (typeof background !== 'string') {
      return res.status(400).json({ error: 'background must be a string' });
    }

    const chatId = req.params.id;
    const chat = await Chat.getById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!(await Chat.isParticipant(chatId, req.userId))) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // === GROUP: Admin can update shared background (chats.background) ===
    if (chat.type === 'group') {
      if (!(await Chat.isAdmin(chatId, req.userId))) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      await Chat.updateBackground(chatId, req.userId, background);
    }

    // === PER-USER OVERRIDE: Store in user_chat_settings (applies to all chat types) ===
    const settingId = uuidv4();
    await run(
      `INSERT INTO user_chat_settings (id, userId, chatId, background)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE background = VALUES(background)`,
      [settingId, req.userId, chatId, background]
    );

    // Invalidate caches
    await cache.invalidateChat(chatId);
    await cache.invalidateAllChats(req.userId);

    // Real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_${chatId}`).emit('user_chat_background_updated', {
        chatId,
        userId: req.userId,
        background,
      });
    }

    res.json({ ok: true, background });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: e.code });
    console.error('Set chat background error:', e);
    res.status(500).json({ error: 'Failed to set background' });
  }
});

/* ==================== GET / - List All Chats (with effective background) ==================== */
router.get('/', async (req, res) => {
  try {
    let chats = await cache.getChats(req.userId);
    if (!chats) {
      chats = await Chat.getByUserId(req.userId);
      await cache.setChats(req.userId, chats, 30);
    }

    // Fetch global background once
    const [globalRow] = await all(`SELECT backgroundGlobal FROM users WHERE id = ? LIMIT 1`, [req.userId]);
    const globalBg = globalRow?.backgroundGlobal || null;

    const seen = new Set();
    const enriched = [];

    for (const chat of chats) {
      if (seen.has(chat.id)) continue;
      seen.add(chat.id);

      // === Determine effective background ===
      const [ucs] = await all(
        `SELECT background FROM user_chat_settings WHERE userId = ? AND chatId = ? LIMIT 1`,
        [req.userId, chat.id]
      );
      const perChatBg = ucs?.background || null;
      const effectiveBg = perChatBg ?? (chat.type === 'group' ? chat.background : globalBg);

      // === Build display info ===
      let displayName = 'Conversation';
      let avatar = null;
      let otherParticipant = null;
      let lastMessageStatus = null;

      const participants = await Chat.getParticipants(chat.id);

      if (chat.type === 'group') {
        displayName = `${chat.name || 'Groupe'} - ${participants.length} membres`;
        avatar = chat.chatAvatar;
      } else {
        // Try to find peer in participants first
        let peer = participants.find(p => String(p.id) !== String(req.userId));

        // Fallback: use user1Id/user2Id from chat object if peer not found in participants
        if (!peer && (chat.user1Id || chat.user2Id)) {
          const peerId = (String(chat.user1Id) === String(req.userId)) ? chat.user2Id : chat.user1Id;
          if (peerId) {
            const peerUser = await User.getById(peerId);
            if (peerUser) {
              peer = {
                id: peerUser.id,
                name: peerUser.name,
                avatar: peerUser.avatar,
                role: peerUser.role,
                isSupport: peerUser.isSupport,
                isOnline: peerUser.isOnline,
              };
            }
          }
        }

        if (peer) {
          displayName = peer.name;
          avatar = peer.avatar;
          otherParticipant = {
            id: peer.id,
            name: peer.name,
            avatar: peer.avatar,
            role: peer.role,
            isSupport: peer.isSupport,
            isOnline: peer.isOnline,
          };
        }
      }

      if (chat.lastMessage && chat.lastMessageSenderId === req.userId) {
        lastMessageStatus = chat.lastMessageReadAt ? 'Vu' : 'Envoye';
      }

      const settings = await Chat.getParticipantSettings(chat.id, req.userId) || {};

      enriched.push({
        id: chat.id,
        type: chat.type,
        name: chat.name,
        displayName,
        avatar,
        otherParticipant,
        background: effectiveBg,
        lastMessage: chat.lastMessage || 'Nouveau chat',
        lastMessageStatus,
        lastMessageTime: chat.lastMessageTime,
        unreadCount: chat.unreadCount || 0,
        isMuted: !!settings.isMuted,
        muteUntil: settings.muteUntil || null,
      });
    }

    res.json({ chats: enriched });
  } catch (e) {
    console.error('Get chats error:', e);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

/* ==================== POST / - Create Chat ==================== */
router.post('/', async (req, res) => {
  try {
    const { type = 'direct', participants = [], name, admins = [], avatar, background } = req.body;

    if (type === 'direct') {
      const other = String(participants[0] || '');
      if (!other) return res.status(400).json({ error: 'Participant required' });
      if (other === req.userId) return res.status(400).json({ error: 'Cannot chat with self' });

      const chatId = await Chat.ensureDirectChatBetween(req.userId, other, req.userId);
      await cache.invalidateAllChats(req.userId);
      await cache.invalidateAllChats(other);

      const io = req.app.get('io');
      if (io) io.to(`user_${other}`).emit('chat_new', { chatId, type: 'direct', otherUserId: req.userId });

      return res.status(201).json({ id: chatId, type: 'direct' });
    }

    if (type === 'group') {
      if (!name?.trim()) return res.status(400).json({ error: 'Group name required' });

      const created = await Chat.createGroup({
        name: name.trim(),
        createdBy: req.userId,
        participants: onlyUnique(participants),
        admins: onlyUnique(admins),
        avatar: avatar || null,
        background: background || null,
      });

      const io = req.app.get('io');
      if (io) {
        const parts = await Chat.getParticipants(created.id);
        parts.forEach(p => {
          if (p.id !== req.userId) {
            io.to(`user_${p.id}`).emit('chat_new', created);
          }
        });
      }

      return res.status(201).json(created);
    }

    res.status(400).json({ error: 'Invalid chat type' });
  } catch (e) {
    const map = { INVALID_INPUT: [400, 'Missing fields'], GROUP_LIMIT_EXCEEDED: [400, 'Max 255 participants'] };
    const known = map[e.code];
    if (known) return res.status(known[0]).json({ error: e.code, message: known[1] });
    console.error('Create chat error:', e);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

/* ==================== GET /:id - Chat Details ==================== */
router.get('/:id', async (req, res) => {
  try {
    let { id } = req.params;
    if (id === SUPPORT_TOKEN) {
      const rows = await all(
        `SELECT id FROM chats WHERE type='group' AND name = ? LIMIT 1`,
        [process.env.SUPPORT_CHAT_NAME || 'Gazavba Support']
      );
      if (!rows.length) return res.status(404).json({ error: 'Support chat not found' });
      id = rows[0].id;
    }

    const chat = await Chat.getById(id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!(await Chat.isParticipant(id, req.userId))) return res.status(403).json({ error: 'FORBIDDEN' });

    let participants = [];
    let otherParticipant = null;
    let displayName = '';
    let avatar = null;

    if (chat.type === 'group') {
      participants = await Chat.getParticipants(id);
      displayName = `${chat.name || 'Groupe'} - ${participants.length} membres`;
      avatar = chat.chatAvatar;
    } else {
      const parts = await Chat.getParticipants(id);
      const peer = parts.find(p => p.id !== req.userId);
      if (peer) {
        displayName = peer.name;
        avatar = peer.avatar;
        otherParticipant = {
          id: peer.id,
          name: peer.name,
          avatar: peer.avatar,
          role: peer.role,
          isSupport: peer.isSupport,
          isOnline: peer.isOnline,
        };
      }
    }

    const settings = await Chat.getParticipantSettings(id, req.userId) || {};
    const [ucs] = await all(`SELECT background FROM user_chat_settings WHERE userId = ? AND chatId = ?`, [req.userId, id]);
    const perChatBg = ucs?.background || null;
    const [globalRow] = await all(`SELECT backgroundGlobal FROM users WHERE id = ?`, [req.userId]);
    const effectiveBg = perChatBg ?? (chat.type === 'group' ? chat.background : globalRow?.backgroundGlobal);

    res.json({
      ...chat,
      participants,
      displayName,
      avatar,
      otherParticipant,
      background: effectiveBg,
      isMuted: !!settings.isMuted,
      muteUntil: settings.muteUntil || null,
    });
  } catch (e) {
    console.error('Get chat error:', e);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

/* ==================== PATCH /:id/avatar - Update Group Avatar ==================== */
router.patch('/:id/avatar', async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error: 'Avatar required' });

    await Chat.updateGroupAvatar(req.params.id, req.userId, avatar);
    await cache.invalidateChat(req.params.id);

    const io = req.app.get('io');
    if (io) io.to(`chat_${req.params.id}`).emit('chat_avatar_updated', { chatId: req.params.id, avatar });

    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: e.code });
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

/* ==================== POST /:id/rename - Rename Group ==================== */
router.post('/:id/rename', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

    await Chat.rename(req.params.id, req.userId, name.trim());
    await cache.invalidateChat(req.params.id);

    const io = req.app.get('io');
    if (io) io.to(`chat_${req.params.id}`).emit('chat_renamed', { chatId: req.params.id, name: name.trim() });

    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: e.code });
    res.status(500).json({ error: 'Failed to rename' });
  }
});

/* ==================== POST /:id/participants - Add Participants ==================== */
router.post('/:id/participants', async (req, res) => {
  try {
    const toAdd = onlyUnique([].concat(req.body?.userId || [], req.body?.userIds || []));
    if (!toAdd.length) return res.status(400).json({ error: 'No users to add' });
    if (!(await Chat.isAdmin(req.params.id, req.userId))) return res.status(403).json({ error: 'Admin required' });

    await Chat.addParticipants(req.params.id, toAdd);
    await cache.invalidateChat(req.params.id);

    const io = req.app.get('io');
    if (io) {
      toAdd.forEach(uid => io.to(`user_${uid}`).emit('chat_joined', { chatId: req.params.id }));
      io.to(`chat_${req.params.id}`).emit('participants_updated', { chatId: req.params.id });
    }

    res.status(201).json({ added: toAdd.length });
  } catch (e) {
    if (e.code === 'GROUP_LIMIT_EXCEEDED') return res.status(400).json({ error: e.code });
    res.status(500).json({ error: 'Failed to add' });
  }
});

/* ==================== DELETE /:id/participants/:userId - Remove Participant ==================== */
router.delete('/:id/participants/:userId', async (req, res) => {
  try {
    await Chat.removeParticipant(req.params.id, req.params.userId, req.userId);
    await cache.invalidateChat(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.params.userId}`).emit('chat_left', { chatId: req.params.id });
      io.to(`chat_${req.params.id}`).emit('participants_updated', { chatId: req.params.id });
    }

    res.json({ ok: true });
  } catch (e) {
    const map = { FORBIDDEN: 403, LAST_ADMIN: 400 };
    if (map[e.code]) return res.status(map[e.code]).json({ error: e.code });
    res.status(500).json({ error: 'Failed to remove' });
  }
});

/* ==================== POST /:id/leave - Leave Chat ==================== */
router.post('/:id/leave', async (req, res) => {
  try {
    await Chat.leave(req.params.id, req.userId);
    await cache.invalidateAllChats(req.userId);

    const io = req.app.get('io');
    if (io) io.to(`chat_${req.params.id}`).emit('participants_updated', { chatId: req.params.id });

    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'LAST_ADMIN') return res.status(400).json({ error: e.code });
    res.status(500).json({ error: 'Failed to leave' });
  }
});

/* ==================== POST /:id/promote - Promote to Admin ==================== */
router.post('/:id/promote', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    await Chat.setAdmin(req.params.id, req.userId, userId, true);
    await cache.invalidateChat(req.params.id);

    const io = req.app.get('io');
    if (io) io.to(`chat_${req.params.id}`).emit('admin_changed', { chatId: req.params.id, userId, isAdmin: true });

    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'FORBIDDEN') return res.status(403).json({ error: e.code });
    res.status(500).json({ error: 'Failed to promote' });
  }
});

/* ==================== POST /:id/demote - Demote from Admin ==================== */
router.post('/:id/demote', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    await Chat.setAdmin(req.params.id, req.userId, userId, false);
    await cache.invalidateChat(req.params.id);

    const io = req.app.get('io');
    if (io) io.to(`chat_${req.params.id}`).emit('admin_changed', { chatId: req.params.id, userId, isAdmin: false });

    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'LAST_ADMIN') return res.status(400).json({ error: e.code });
    res.status(500).json({ error: 'Failed to demote' });
  }
});

/* ==================== POST /:id/mute - Mute Chat ==================== */
router.post('/:id/mute', async (req, res) => {
  try {
    const { durationMinutes } = req.body || {};
    let muteUntil = null;
    if (durationMinutes) {
      const mins = Number(durationMinutes);
      if (mins > 0) muteUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();
    }

    const settings = await Chat.setMute(req.params.id, req.userId, { muteUntil, isMuted: true });
    await cache.invalidateAllChats(req.userId);

    res.json({ success: true, settings });
  } catch {
    res.status(500).json({ error: 'Failed to mute' });
  }
});

/* ==================== POST /:id/unmute - Unmute Chat ==================== */
router.post('/:id/unmute', async (req, res) => {
  try {
    const settings = await Chat.setMute(req.params.id, req.userId, { isMuted: false });
    await cache.invalidateAllChats(req.userId);

    res.json({ success: true, settings });
  } catch {
    res.status(500).json({ error: 'Failed to unmute' });
  }
});

/* ==================== GET /:id/participants - List Participants ==================== */
router.get('/:id/participants', async (req, res) => {
  try {
    if (!(await Chat.isParticipant(req.params.id, req.userId))) return res.status(403).json({ error: 'FORBIDDEN' });
    const participants = await Chat.getParticipants(req.params.id);
    res.json(participants);
  } catch {
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

/* ==================== POST /:id/read - Mark Chat as Read ==================== */
router.post('/:id/read', async (req, res) => {
  try {
    if (!(await Chat.isParticipant(req.params.id, req.userId))) return res.status(403).json({ error: 'FORBIDDEN' });

    const messages = await Message.getByChatId(req.params.id, req.userId, 1000);
    const unreadIds = messages.filter(m => m.receiverId === req.userId && !m.readAt).map(m => m.id);

    if (unreadIds.length > 0) {
      await Message.markAsReadBatch(unreadIds, req.userId);
      await cache.invalidateAllChats(req.userId);
    }

    const io = req.app.get('io');
    if (io) io.to(`chat_${req.params.id}`).emit('chat_read', { chatId: req.params.id, userId: req.userId });

    res.json({ ok: true, marked: unreadIds.length });
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;