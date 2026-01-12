/* eslint-env node */
const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const { authenticateToken } = require('../middleware/auth');

// Create a poll
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { question, options, allowMultiple } = req.body;
        const poll = await Poll.create({ question, options, allowMultiple });
        res.json(poll);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

// Vote on a poll
router.post('/:id/vote', authenticateToken, async (req, res) => {
    try {
        const { optionId } = req.body;
        const userId = req.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Access token required' });
        const poll = await Poll.vote(req.params.id, userId, optionId);

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('poll:updated', { pollId: req.params.id, poll });
        }

        res.json(poll);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'SERVER_ERROR' });
    }
});

module.exports = router;
