const express = require('express');
const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
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

// Get user's chats
router.get('/', authenticateToken, async (req, res) => {
  try {
    const chats = await Chat.getByUserId(req.userId);
    const enriched = await Promise.all(
      chats.map(async (chat) => {
        const participants = await Chat.getParticipants(chat.id);
        const others = participants.filter((participant) => participant.userId !== req.userId && participant.id !== req.userId);
        const primary = chat.type === 'direct' ? others[0] : null;

        const displayName =
          chat.type === 'group'
            ? chat.name || `Group • ${participants.length} members`
            : primary?.name || chat.name || 'Conversation';

        const avatar = chat.type === 'group' ? chat.avatar || null : primary?.avatar || null;

        return {
          ...chat,
          unreadCount: Number(chat.unreadCount || 0),
          participants,
          displayName,
          avatar,
          otherParticipant: primary || null,
          isMuted: !!chat.isMuted,
          muteUntil: chat.muteUntil || null,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Create new chat
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type = 'direct', participants } = req.body;
    
    if (!participants || participants.length === 0) {
      return res.status(400).json({ error: 'Participants required' });
    }

    // For direct chats, check if chat already exists
    if (type === 'direct' && participants.length === 1) {
      const existingChat = await Chat.getDirectChat(req.userId, participants[0]);
      if (existingChat) {
        return res.json(existingChat);
      }
    }

    const chat = await Chat.create({
      name,
      type,
      createdBy: req.userId,
      participants: [req.userId, ...participants]
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get chat by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const chat = await Chat.getById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const participants = await Chat.getParticipants(req.params.id);
    const others = participants.filter((participant) => participant.userId !== req.userId && participant.id !== req.userId);
    const primary = chat.type === 'direct' ? others[0] : null;
    const preferences = await Chat.getParticipantSettings(req.params.id, req.userId);

    const displayName =
      chat.type === 'group'
        ? chat.name || `Group • ${participants.length} members`
        : primary?.name || chat.name || 'Conversation';

    const avatar = chat.type === 'group' ? chat.avatar || null : primary?.avatar || null;

    res.json({
      ...chat,
      participants,
      displayName,
      avatar,
      isMuted: !!preferences?.isMuted,
      muteUntil: preferences?.muteUntil || null,
      otherParticipant: primary || null,
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

router.post('/:id/mute', authenticateToken, async (req, res) => {
  try {
    const { durationMinutes = null } = req.body || {};
    let muteUntil = null;
    if (durationMinutes !== null && durationMinutes !== undefined) {
      const minutes = Number(durationMinutes);
      if (!Number.isNaN(minutes) && minutes > 0) {
        muteUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      }
    }
    const settings = await Chat.setMute(req.params.id, req.userId, { muteUntil, isMuted: true });
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Mute chat error:', error);
    res.status(500).json({ error: 'Failed to mute chat' });
  }
});

router.post('/:id/unmute', authenticateToken, async (req, res) => {
  try {
    const settings = await Chat.setMute(req.params.id, req.userId, { muteUntil: null, isMuted: false });
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Unmute chat error:', error);
    res.status(500).json({ error: 'Failed to unmute chat' });
  }
});

// Get chat participants
router.get('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const participants = await Chat.getParticipants(req.params.id);
    res.json(participants);
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Add participant to chat
router.post('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const participant = await Chat.addParticipant(req.params.id, userId);
    res.status(201).json(participant);
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Remove participant from chat
router.delete('/:id/participants/:userId', authenticateToken, async (req, res) => {
  try {
    await Chat.removeParticipant(req.params.id, req.params.userId);
    res.json({ message: 'Participant removed' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Mark chat as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    await Message.markChatAsRead(req.params.id, req.userId);
    res.json({ message: 'Chat marked as read' });
  } catch (error) {
    console.error('Mark chat as read error:', error);
    res.status(500).json({ error: 'Failed to mark chat as read' });
  }
});

module.exports = router;
