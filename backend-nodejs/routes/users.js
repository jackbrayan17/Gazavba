/* eslint-env node */
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const UserChatSettings = require('../models/UserChatSettings');
const { JWT_SECRET } = require('../config/auth');

const router = express.Router();

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '').trim();

/* ==================== AUTH MIDDLEWARE ==================== */
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = decoded.userId || decoded.id;
    if (!req.userId) return res.status(403).json({ error: 'Invalid token payload' });
    next();
  });
};

/* ==================== UPLOADS (AVATARS) ==================== */
const resolveUploadDir = (value) =>
  value ? (path.isAbsolute(value) ? value : path.resolve(process.cwd(), value)) : path.resolve(process.cwd(), 'uploads');

const uploadDir = resolveUploadDir(process.env.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${unique}${path.extname(file.originalname || '')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

function maybeHandleAvatarUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('avatar')(req, res, next);
  }
  next();
}

const normalizeNullable = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null') return null;
  return text;
};

/* ==================== ROUTES ==================== */

/**
 * GET /api/users → List all users
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (e) {
    console.error('Get users error:', e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/search → Search users
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q ?? '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Search query required' });
    const users = await User.search(q);
    res.json({ users });
  } catch (e) {
    console.error('Search users error:', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/users/profile → Get own profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.getById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (e) {
    console.error('Get profile error:', e);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/users/profile → Update profile (name, bio, avatar, backgroundGlobal, statusPrivacy)
 */
const handleProfileUpdate = async (req, res) => {
  try {
    const { name, bio, avatar, backgroundGlobal, statusPrivacy, email, phone } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = normalizeNullable(name);
    if (bio !== undefined) updates.bio = normalizeNullable(bio);
    if (email !== undefined) updates.email = normalizeNullable(email);
    if (phone !== undefined) updates.phone = normalizeNullable(phone);
    if (backgroundGlobal !== undefined) {
      updates.backgroundGlobal = normalizeNullable(backgroundGlobal);
    }
    if (statusPrivacy !== undefined) {
      if (!['private', 'general'].includes(statusPrivacy)) {
        return res.status(400).json({ error: 'statusPrivacy must be "private" or "general"' });
      }
      updates.statusPrivacy = statusPrivacy;
    }
    if (req.file) {
      updates.avatar = `/uploads/${req.file.filename}`;
    } else if (avatar !== undefined) {
      updates.avatar = normalizeNullable(avatar);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updated = await User.update(req.userId, updates);
    if (!updated) return res.status(404).json({ error: 'User not found' });

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', {
        userId: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        avatar: updated.avatar,
        bio: updated.bio,
        backgroundGlobal: updated.backgroundGlobal,
        statusPrivacy: updated.statusPrivacy,
      });
    }

    res.json({ user: updated });
  } catch (e) {
    console.error('Update profile error:', e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

router.patch('/profile', authenticateToken, maybeHandleAvatarUpload, handleProfileUpdate);
router.put('/profile', authenticateToken, maybeHandleAvatarUpload, handleProfileUpdate);

/**
 * POST /api/users/avatar → Upload avatar
 */
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const avatar = `/uploads/${req.file.filename}`;
    const updated = await User.update(req.userId, { avatar });

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: req.userId, avatar: updated.avatar });
    }

    res.json({ avatar: updated.avatar });
  } catch (e) {
    console.error('Upload avatar error:', e);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

/**
 * PATCH /api/users/background/global → Set global background
 */
router.patch('/background/global', authenticateToken, async (req, res) => {
  try {
    const { background } = req.body;
    if (background === undefined) {
      return res.status(400).json({ error: 'Background required' });
    }

    await User.setGlobalBackground(req.userId, background === null ? null : background);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_updated', { userId: req.userId, backgroundGlobal: background });
    }

    res.json({ backgroundGlobal: background });
  } catch (e) {
    console.error('Set global background error:', e);
    res.status(500).json({ error: 'Failed to set background' });
  }
});

/**
 * POST /api/users/match-contacts → Match phone contacts
 */
router.post('/match-contacts', authenticateToken, async (req, res) => {
  try {
    const contacts = Array.isArray(req.body.contacts) ? req.body.contacts : null;
    if (!contacts || !contacts.length) {
      return res.status(400).json({ error: 'Contacts array required' });
    }

    const normalized = contacts.map(normalizePhone).filter(Boolean);
    if (!normalized.length) {
      return res.json({ matches: [], unmatched: [] });
    }

    const matchesRaw = await User.getByPhones(normalized);
    const seen = new Set();
    const matches = [];

    for (const u of matchesRaw) {
      const key = normalizePhone(u.phone || '');
      if (key && !seen.has(key)) {
        seen.add(key);
        matches.push(u);
      }
    }

    const matchSet = new Set(matches.map(u => normalizePhone(u.phone)));
    const unmatched = normalized.filter(p => !matchSet.has(p));

    const mapped = matches.map(u => ({
      id: u.id,
      name: u.name || u.phone || 'Contact',
      phone: u.phone || '',
      email: u.email || null,
      avatar: u.avatar || null,
      bio: u.bio || null,
      hasAccount: true,
      isRegistered: true,
      lastInteraction: u.lastSeen || null,
      lastSeen: u.lastSeen || null,
      isFavourite: false,
      role: u.role,
      isVerified: !!u.isVerified,
      isOnline: !!u.isOnline,
      isSupport: !!u.isSupport,
      statusPrivacy: u.statusPrivacy || 'private',
    }));

    const unmatchedMapped = unmatched.map(p => ({
      id: p,
      name: p,
      phone: p,
      email: null,
      avatar: null,
      bio: null,
      hasAccount: false,
      isRegistered: false,
      lastInteraction: null,
      isFavourite: false,
      role: 'guest',
      isVerified: false,
      isOnline: false,
      isSupport: false,
      statusPrivacy: 'private',
    }));

    res.json({ matches: mapped, unmatched: unmatchedMapped });
  } catch (e) {
    console.error('Match contacts error:', e);
    res.status(500).json({ error: 'Failed to match contacts' });
  }
});

/**
 * POST /api/users/online → Set online status
 */
router.post('/online', authenticateToken, async (req, res) => {
  try {
    const { isOnline } = req.body;
    await User.setOnlineStatus(req.userId, !!isOnline);

    const io = req.app.get('io');
    if (io) {
      io.emit('user_online', { userId: req.userId, isOnline: !!isOnline });
    }

    res.json({ isOnline: !!isOnline });
  } catch (e) {
    console.error('Set online status error:', e);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
