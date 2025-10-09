const express = require('express');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const router = express.Router();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Get messages for a chat
router.get('/chat/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const messages = await Message.getByChatId(chatId, parseInt(limit), parseInt(offset));
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { chatId, text, messageType = 'text', mediaUrl } = req.body;
    
    if (!chatId || !text) {
      return res.status(400).json({ error: 'Chat ID and text required' });
    }

    const message = await Message.create({
      chatId,
      senderId: req.userId,
      text,
      messageType,
      mediaUrl
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark message as read
router.post('/:messageId/read', authenticateToken, async (req, res) => {
  try {
    await Message.markAsRead(req.params.messageId, req.userId);
    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Delete message
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    await Message.delete(req.params.messageId);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get unread count for a chat
router.get('/chat/:chatId/unread', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const unreadCount = await Message.getUnreadCount(chatId, req.userId);
    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
