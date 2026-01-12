/* eslint-env node */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Status = require('../models/Status');
const { JWT_SECRET } = require('../config/auth');
const { cache } = require('../config/cache');
const { all } = require('../config/database');

const router = express.Router();

/* ==================== AUTH ==================== */
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

/* ==================== UPLOADS ==================== */
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `status-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || '.bin'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/* ==================== ROUTES ==================== */

/**
 * GET /api/statuses → Get all visible statuses (respects statusPrivacy)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const statuses = await Status.getAll(req.userId);
    res.json({ statuses });
  } catch (e) {
    console.error('[statuses] GET / error:', e);
    res.status(500).json({ error: 'Failed to load statuses' });
  }
});

/**
 * GET /api/statuses/unseen/count → Unseen status count (respects privacy)
 */
router.get('/unseen/count', authenticateToken, async (req, res) => {
  try {
    const count = await Status.getUnseenCount(req.userId);
    res.json({ count });
  } catch (e) {
    console.error('[statuses] unseen/count error:', e);
    res.status(500).json({ error: 'Failed to get unseen count' });
  }
});

/**
 * POST /api/statuses → Create new status
 */
router.post('/', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    let type = req.body.type?.toLowerCase() || 'text';
    const content = req.body.content?.trim() || null;
    const expiresInHours = Number(req.body.expiresInHours) || 24;

    let mediaUrl = null;
    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
      type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    } else if (req.body.mediaUrl) {
      mediaUrl = req.body.mediaUrl;
      type = req.body.type || (mediaUrl.includes('video') ? 'video' : 'image');
    }

    if (!['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ error: 'Invalid status type' });
    }
    if (type === 'text' && !content) {
      return res.status(400).json({ error: 'Text content required' });
    }
    if ((type === 'image' || type === 'video') && !mediaUrl) {
      return res.status(400).json({ error: 'Media required for image/video status' });
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 3600000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const status = await Status.create({
      userId: req.userId,
      type,
      content,
      mediaUrl,
      expiresAt,
    });

    // Invalidate all status caches
    await cache.invalidate(`status:*`);

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('status_new', {
        ...status,
        userName: status.userName,
        userAvatar: status.userAvatar,
        viewCount: 0,
        hasViewed: false,
      });
    }

    res.status(201).json({
      status: {
        ...status,
        viewCount: 0,
        hasViewed: false,
      },
    });
  } catch (e) {
    console.error('[statuses] POST / error:', e);
    res.status(500).json({ error: 'Failed to create status' });
  }
});

/**
 * POST /api/statuses/:id/view → Mark status as viewed
 */
router.post('/:id/view', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await Status.markAsViewed(id, req.userId);
    await cache.invalidate(`status:all:*`);

    const io = req.app.get('io');
    if (io) {
      // Notify owner
      const [status] = await all(`SELECT userId FROM statuses WHERE id = ?`, [id]);
      if (status && status.userId) {
        io.to(`user_${status.userId}`).emit('status_viewed', {
          statusId: id,
          viewerId: req.userId,
        });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[statuses] POST /:id/view error:', e);
    res.status(500).json({ error: 'Failed to mark as viewed' });
  }
});

/**
 * GET /api/statuses/:id/viewers → Get viewers (only if allowed by privacy)
 */
router.get('/:id/viewers', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const order = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const limit = req.query.limit ? Math.max(1, Number(req.query.limit)) : 50;
    const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : 0;

    // Check if viewer can see this status
    const statuses = await Status.getAll(req.userId);
    const status = statuses.find(s => s.id === id);
    if (!status) {
      return res.status(404).json({ error: 'Status not found or not visible to you' });
    }

    const viewers = await Status.getViewers(id, { order, limit, offset });
    const flattened = viewers.map((entry) => ({
      ...entry.user,
      viewedAt: entry.viewedAt,
    }));

    res.json({ viewers: flattened });
  } catch (e) {
    console.error('[statuses] GET /:id/viewers error:', e);
    res.status(500).json({ error: 'Failed to load viewers' });
  }
});

/**
 * DELETE /api/statuses/:id → Delete own status
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const status = await Status.getById?.(id) || (await all(`SELECT userId FROM statuses WHERE id = ?`, [id]))[0];
    if (!status) return res.status(404).json({ error: 'Status not found' });
    if (status.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    await Status.delete(id);
    await cache.invalidate(`status:*`);

    const io = req.app.get('io');
    if (io) io.emit('status_deleted', { statusId: id });

    res.json({ ok: true });
  } catch (e) {
    console.error('[statuses] DELETE /:id error:', e);
    res.status(500).json({ error: 'Failed to delete status' });
  }
});

/**
 * GET /api/statuses/user/:userId - Get a user's statuses if visible
 */
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = String(req.params.userId || '');
    if (!userId) return res.json({ statuses: [] });

    if (userId !== req.userId) {
      const [userRow] = await all(
        `SELECT statusPrivacy FROM users WHERE id = ? LIMIT 1`,
        [userId]
      );
      const privacy = userRow?.statusPrivacy || 'private';
      if (privacy !== 'general') {
        const [link] = await all(
          `SELECT 1 FROM contacts c
           WHERE (c.ownerId = ? AND c.hasAccountUserId = ?)
              OR (c.ownerId = ? AND c.hasAccountUserId = ?)
           LIMIT 1`,
          [req.userId, userId, userId, req.userId]
        );
        if (!link) {
          return res.json({ statuses: [] });
        }
      }
    }

    const statuses = await Status.getByUserId(userId);
    res.json({ statuses });
  } catch (e) {
    console.error('[statuses] GET /user/:userId error:', e);
    res.status(500).json({ error: 'Failed to load statuses' });
  }
});

/* ==================== ERROR HANDLER ==================== */
router.use((err, _req, res, _next) => {
  console.error('[statuses] Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = router;
