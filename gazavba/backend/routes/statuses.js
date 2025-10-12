const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Status = require('../models/Status');
const { JWT_SECRET } = require('../config/auth');
const router = express.Router();

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

// Configure multer for status media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'status-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for status media
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Get all statuses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const statuses = await Status.getAll(req.userId);
    res.json(statuses);
  } catch (error) {
    console.error('Get statuses error:', error);
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// Get user's statuses
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const statuses = await Status.getByUserId(userId);
    res.json(statuses);
  } catch (error) {
    console.error('Get user statuses error:', error);
    res.status(500).json({ error: 'Failed to fetch user statuses' });
  }
});

// Create text status
router.post('/text', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const status = await Status.create({
      userId: req.userId,
      type: 'text',
      content,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    res.status(201).json(status);
  } catch (error) {
    console.error('Create text status error:', error);
    res.status(500).json({ error: 'Failed to create status' });
  }
});

  // Create media status
  router.post('/media', authenticateToken, upload.single('media'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No media file uploaded' });
      }

      const mediaUrl = `/uploads/${req.file.filename}`;
      const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

      const status = await Status.create({
        userId: req.userId,
        type,
        content: req.body.content || '',
        mediaUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      res.status(201).json(status);
    } catch (error) {
      console.error('Create media status error:', error);
      res.status(500).json({ error: 'Failed to create status' });
    }
  });

// Mark status as viewed
router.post('/:statusId/view', authenticateToken, async (req, res) => {
  try {
    const { statusId } = req.params;
    await Status.markAsViewed(statusId, req.userId);
    res.json({ message: 'Status marked as viewed' });
  } catch (error) {
    console.error('Mark status as viewed error:', error);
    res.status(500).json({ error: 'Failed to mark status as viewed' });
  }
});

// Get status viewers
router.get('/:statusId/viewers', authenticateToken, async (req, res) => {
  try {
    const { statusId } = req.params;
    const viewers = await Status.getViewers(statusId);
    res.json(viewers);
  } catch (error) {
    console.error('Get status viewers error:', error);
    res.status(500).json({ error: 'Failed to fetch viewers' });
  }
});

// Delete status
router.delete('/:statusId', authenticateToken, async (req, res) => {
  try {
    const { statusId } = req.params;
    await Status.delete(statusId);
    res.json({ message: 'Status deleted' });
  } catch (error) {
    console.error('Delete status error:', error);
    res.status(500).json({ error: 'Failed to delete status' });
  }
});

// Get unseen status count
router.get('/unseen/count', authenticateToken, async (req, res) => {
  try {
    const count = await Status.getUnseenCount(req.userId);
    res.json({ count });
  } catch (error) {
    console.error('Get unseen count error:', error);
    res.status(500).json({ error: 'Failed to fetch unseen count' });
  }
});

module.exports = router;
