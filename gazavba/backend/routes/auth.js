const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/auth');

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '').trim();
const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const router = express.Router();

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
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${unique}${path.extname(file.originalname)}`);
  },
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const maybeHandleAvatarUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Register
router.post('/register', maybeHandleAvatarUpload, async (req, res) => {
  try {
    const { name, email, phone, password, avatar, role } = req.body;

    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : (avatar || null);

    if (!trimmedName || !normalizedPhone || !password) {
      return res.status(400).json({ error: 'Name, phone number and password are required' });
    }

    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    let existingUser = null;
    if (trimmedEmail) {
      existingUser = await User.getByEmail(trimmedEmail);
    }
    if (!existingUser) {
      existingUser = await User.getByPhone(normalizedPhone);
    }

    if (existingUser) {
      return res.status(400).json({ error: 'An account already exists with the provided email or phone number' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail || null,
      phone: normalizedPhone,
      avatar: avatarUrl,
      password: hashedPassword,
      role: role || 'user',
      isSuperAdmin: false,
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;

    const rawLogin = (identifier || email || phone || '').toString().trim();

    if (!rawLogin || !password) {
      return res.status(400).json({ error: 'Identifier and password are required' });
    }

    const lookup = rawLogin.includes('@') ? User.getByEmail : User.getByPhone;
    const normalizedLogin = rawLogin.includes('@')
      ? rawLogin.toLowerCase()
      : normalizePhone(rawLogin);
    const user = await lookup.call(User, normalizedLogin);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update online status
    await User.setOnlineStatus(user.id, true);

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isSuperAdmin: !!user.isSuperAdmin,
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.getById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } });
  } catch (_error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      await User.setOnlineStatus(decoded.userId, false);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
