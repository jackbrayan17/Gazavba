/* eslint-env node */
const express = require('express');
const router = express.Router();
const Call = require('../models/Call');

// Import middleware defensively to avoid undefined callback
const authMiddleware = require('../middleware/auth');
const authenticateToken =
  (authMiddleware && authMiddleware.authenticateToken) || authMiddleware;

// Get call history
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Access token required' });
        const history = await Call.getHistory(userId);
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Initiate a call (metadata only, signaling via socket)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { receiverId, chatId, type } = req.body;
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Access token required' });
        const call = await Call.create({
            callerId: userId,
            receiverId,
            chatId,
            type
        });
        res.json(call);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

module.exports = router;
