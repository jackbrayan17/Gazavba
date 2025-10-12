/* eslint-env node */
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/auth');
const router = express.Router();

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '').trim();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Configure multer for file uploads
const resolveUploadDir = (value) => {
  if (!value) {
    return path.resolve(process.cwd(), 'uploads');
  }
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};

const uploadDir = resolveUploadDir(process.env.UPLOAD_PATH);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const users = await User.search(q);
    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.getById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone) updates.phone = normalizePhone(phone);

    const user = await User.update(req.userId, updates);
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    await User.update(req.userId, { avatar: avatarUrl });

    res.json({ avatar: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

router.post('/match-contacts', authenticateToken, async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Contacts array required' });
    }

    const normalized = contacts
      .map(contact => normalizePhone(contact))
      .filter(Boolean);

    if (normalized.length === 0) {
      return res.json({ matches: [], unmatched: [] });
    }

    const matches = await User.getByPhones(normalized);
    const matchSet = new Set(matches.map(user => normalizePhone(user.phone)));
    const unmatched = Array.from(new Set(normalized.filter(phone => !matchSet.has(phone))));

    res.json({ matches, unmatched });
  } catch (error) {
    console.error('Match contacts error:', error);
    res.status(500).json({ error: 'Failed to match contacts' });
  }
});

// Set online status
router.post('/online', authenticateToken, async (req, res) => {
  try {
    const { isOnline } = req.body;
    await User.setOnlineStatus(req.userId, isOnline);
    res.json({ isOnline });
  } catch (error) {
    console.error('Set online status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
