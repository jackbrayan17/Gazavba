/* eslint-env node */
const express = require('express');
const jwt = require('jsonwebtoken');
const Contact = require('../models/Contact');
const User = require('../models/User');
const Chat = require('../models/Chat');
const { all } = require('../config/database');

let { JWT_SECRET } = (() => {
  try {
    return require('../config/auth');
  } catch {
    return { JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me' };
  }
})();

const router = express.Router();

/* ---------- AUTH ---------- */
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

/* ---------- HELPERS ---------- */
const parseContactsInput = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return input.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }
  return [input];
};

const normalize = (v = '') => (v ?? '').toString().replace(/[^\d+]/g, '').trim();

/* =========================================================
   GET /api/contacts
========================================================= */
router.get('/', async (req, res) => {
  try {
    const rows = await Contact.list(req.userId);
    res.json({ contacts: rows });
  } catch (e) {
    console.error('Get contacts error:', e);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/* =========================================================
   POST /api/contacts (compat)
========================================================= */
router.post('/', async (req, res) => {
  try {
    const rows = await Contact.list(req.userId);
    res.json({ contacts: rows });
  } catch (e) {
    console.error('Post contacts error:', e);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/* =========================================================
   POST /api/contacts/sync
========================================================= */
router.post('/sync', async (req, res) => {
  try {
    const raw = req.body?.contacts ?? req.body?.phones ?? req.body ?? [];
    const payload = parseContactsInput(raw);
    const contacts = await Contact.upsertMany(req.userId, payload);
    res.json({ contacts });
  } catch (e) {
    console.error('Sync contacts error:', e);
    res.status(500).json({ error: 'Failed to sync contacts' });
  }
});

/* =========================================================
   POST /api/contacts/match-contacts (compat)
========================================================= */
router.post('/match-contacts', async (req, res) => {
  try {
    const raw = req.body?.contacts ?? req.body?.phones ?? [];
    const payload = parseContactsInput(raw);
    const nums = [];

    payload.forEach((e) => {
      if (!e) return;
      if (typeof e === 'string') {
        const p = normalize(e);
        if (p) nums.push(p);
        return;
      }
      if (typeof e === 'object') {
        const p = normalize(e.phone || e.number || e.phoneNumber);
        if (p) nums.push(p);
        if (Array.isArray(e.phones)) {
          e.phones.forEach((x) => {
            const y = normalize(x);
            if (y) nums.push(y);
          });
        }
      }
    });

    const unique = Array.from(new Set(nums));
    if (!unique.length) return res.json({ matches: [], unmatched: [] });

    const matches = await User.getByPhones(unique);
    const matchedSet = new Set(matches.map((u) => normalize(u.phone)));
    const unmatched = unique.filter((p) => !matchedSet.has(p));

    res.json({ matches, unmatched });
  } catch (e) {
    console.error('Match contacts error:', e);
    res.status(500).json({ error: 'Failed to match contacts' });
  }
});

/* =========================================================
   GET /api/contacts/search?q=...&limit=20
========================================================= */
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '20', 10)));
    if (!q) return res.json({ results: [] });

    const like = `%${q}%`;
    const results = await all(
      `SELECT
         u.id, u.name, u.email, u.phone, u.avatar,
         u.role, u.isVerified, u.isSupport, u.isOnline, u.lastSeen,
         CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS isInContacts,
         c.id AS contactId
       FROM users u
       LEFT JOIN contacts c
         ON c.ownerId = ? AND c.hasAccountUserId = u.id
       WHERE (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
         AND u.id <> ?
       ORDER BY u.name IS NULL, LOWER(u.name) ASC
       LIMIT ?`,
      [req.userId, like, like, like, req.userId, limit]
    );

    res.json({ results });
  } catch (e) {
    console.error('Search contacts error:', e);
    res.status(500).json({ error: 'Failed to search directory' });
  }
});

/* =========================================================
   POST /api/contacts/save
   → Sauvegarde un contact + émet un événement en temps réel
========================================================= */
router.post('/save', async (req, res) => {
  try {
    const payload = req.body?.contact ?? req.body ?? {};
    const rawPhone = payload.phone || payload.number || payload.phoneNumber || '';
    const phone = normalize(rawPhone);
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    // Trouver l'utilisateur cible
    const target = await User.getByPhone(phone);
    if (target && target.id) {
      const io = req.app.get('io');
      const saver = await User.getById(req.userId);
      if (io) {
        io.to(`user_${target.id}`).emit('contact_saved', {
          userId: req.userId,
          name: saver?.name || 'Someone',
          phone: saver?.phone || null,
        });
      }
    }

    // Sauvegarder localement
    const contacts = await Contact.upsertOne(req.userId, payload);
    return res.json({ success: true, contacts });
  } catch (e) {
    console.error('Contact save emit error:', e);
    return res.status(500).json({ error: 'Failed to save contact' });
  }
});

/* =========================================================
   POST /api/contacts/start-chat
   → Démarre un chat 1-to-1
========================================================= */
router.post('/start-chat', async (req, res) => {
  try {
    const { userId: targetUserIdRaw, phone: phoneRaw } = req.body || {};
    let targetUserId = (targetUserIdRaw || '').toString().trim();

    // Recherche par téléphone
    if (!targetUserId && phoneRaw) {
      const p = normalize(phoneRaw);
      if (p) {
        const rows = await all(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [p]);
        targetUserId = rows?.[0]?.id || '';
        if (!targetUserId) {
          await Contact.upsertOne(req.userId, { phone: p, name: p });
          const contacts = await Contact.list(req.userId);
          return res.status(404).json({
            error: 'TARGET_NOT_FOUND',
            message: 'No Gazavba account with this phone. Contact saved in your phonebook.',
            contacts,
          });
        }
      }
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Missing userId or phone' });
    }

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot start a direct chat with yourself' });
    }

    // VÉRIFIER QUE L'UTILISATEUR CIBLE EXISTE
    const userExists = await all(`SELECT id FROM users WHERE id = ? LIMIT 1`, [targetUserId]);
    if (!userExists.length) {
      return res.status(404).json({ error: 'TARGET_NOT_FOUND', message: 'User not found' });
    }

    // CRÉER OU RÉCUPÉRER LE CHAT DIRECT
    const chatId = await Chat.ensureDirectChatBetween(req.userId, targetUserId);
    if (!chatId) {
      throw new Error('FAILED_TO_CREATE_CHAT');
    }

    const chat = await Chat.getById(chatId);
    if (!chat) {
      throw new Error('CHAT_NOT_FOUND_AFTER_CREATION');
    }

    // Récupérer les participants
    let participants = await Chat.getParticipants(chatId);
    const seen = new Set();
    participants = participants.filter((p) => {
      const key = String(p.userId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const peer = participants.find((p) => String(p.userId) !== String(req.userId));
    const displayName = peer?.name || chat?.name || 'Conversation';

    res.json({
      chat: {
        ...chat,
        name: chat?.name ?? null,
        displayName,
      },
      participants,
    });
  } catch (e) {
    console.error('Start-chat error:', e);
    res.status(500).json({ error: 'Failed to start chat', details: e.message });
  }
});

module.exports = router;
