/* eslint-env node */
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { cache } = require('../config/cache'); // UPSTASH REDIS
const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

/* =========================
   JWT SECRET
========================= */
let JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
try {
  ({ JWT_SECRET } = require('../config/auth'));
} catch (_) {}

/* =========================
   TOKEN CONFIG
========================= */
const ACCESS_TOKEN_EXPIRES = '15m';  // Sécurité
const REFRESH_TOKEN_EXPIRES = '90d'; // Persistance (même après mise à jour)

/* =========================
   UPLOADS (AVATAR)
========================= */
const resolveUploadDir = (value) => {
  if (!value) return path.resolve(process.cwd(), 'uploads');
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};
const uploadDir = resolveUploadDir(process.env.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || '.jpg'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  },
});

function maybeHandleAvatarUpload(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return upload.single('avatar')(req, res, next);
  }
  next();
}

/* =========================
   HELPERS
========================= */
const signAccessToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
const signRefreshToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });

const getAuthToken = (req) => {
  const h = req.headers.authorization || '';
  const parts = h.split(' ');
  return parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
};

const normalizePhone = (v = '') => {
  const s = String(v).trim();
  return s.startsWith('+') ? '+' + s.replace(/[^\d]/g, '') : s.replace(/[^\d]/g, '');
};

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

/* =========================
   REFRESH TOKEN STORAGE (Redis)
========================= */
const storeRefreshToken = async (userId, token) => {
  await cache.set(`refresh_token:${userId}`, token, 90 * 24 * 60 * 60); // 90 jours
};

const verifyRefreshToken = async (userId, token) => {
  const stored = await cache.get(`refresh_token:${userId}`);
  return stored === token;
};

/* =========================
   ROUTES
========================= */

// GET /auth/verify
router.get('/verify', async (req, res) => {
  const token = getAuthToken(req);
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    const user = await User.getById(userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    return res.json({ ok: true, userId });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// POST /auth/register
router.post('/register', maybeHandleAvatarUpload, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    const file = req.file || null;

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const pass = String(password || '');

    const missing = [];
    if (!trimmedName) missing.push('name');
    if (!normalizedPhone) missing.push('phone');
    if (!pass) missing.push('password');
    if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (pass.length < 6) {
      return res.status(400).json({ error: 'Password too short' });
    }

    if (trimmedEmail) {
      const exists = await User.getByEmail(trimmedEmail);
      if (exists) return res.status(409).json({ error: 'Email taken' });
    }
    const phoneExists = await User.getByPhone(normalizedPhone);
    if (phoneExists) return res.status(409).json({ error: 'Phone taken' });

    const passwordHash = await bcrypt.hash(pass, 10);
    const avatarUrl = file ? `/uploads/${file.filename}` : null;

    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail || null,
      phone: normalizedPhone,
      password: passwordHash,
      avatar: avatarUrl,
    });

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);

    res.status(201).json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or phone already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body || {};
    const pass = String(password || '');
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);

    if ((!trimmedEmail && !normalizedPhone) || !pass) {
      return res.status(400).json({ error: 'Credentials required' });
    }

    let user;
    if (trimmedEmail) {
      if (!isValidEmail(trimmedEmail)) return res.status(400).json({ error: 'Invalid email' });
      user = await User.getByEmail(trimmedEmail);
    } else {
      user = await User.getByPhone(normalizedPhone);
    }

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(pass, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);

    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const valid = await verifyRefreshToken(decoded.userId, refreshToken);
    if (!valid) return res.status(403).json({ error: 'Refresh token revoked' });

    const newAccessToken = signAccessToken(decoded.userId);
    const newRefreshToken = signRefreshToken(decoded.userId);
    await storeRefreshToken(decoded.userId, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  try {
    const token = getAuthToken(req);
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.userId) {
          await cache.del(`refresh_token:${decoded.userId}`);
        }
      } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;