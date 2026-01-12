/* eslint-env node */
const { run, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Chat = require('./Chat');
const { cache } = require('../config/cache');

class Message {
  static async create(data) {
    const {
      chatId,
      senderId,
      text,
      messageType = 'text',
      mediaUrl,
      mediaName,
      clientId: inputClientId,
    } = data;
    if (!chatId || !senderId) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }
    const id = data.id || uuidv4();
    const clientId = inputClientId || uuidv4();
    const existing = await this.getByClientId(clientId);
    if (existing) return existing;

    const chat = await Chat.getById(chatId);
    if (!chat) throw new Error('CHAT_NOT_FOUND');

    if (chat.type === 'direct') {
      if (![chat.user1Id, chat.user2Id].includes(senderId)) {
        throw new Error('SENDER_NOT_IN_CHAT');
      }
    } else if (chat.type === 'group') {
      const participant = await all(`SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ?`, [chatId, senderId]);
      if (!participant.length) throw new Error('SENDER_NOT_IN_GROUP');
    }

    let receiverId = null;
    if (chat.type === 'direct') {
      receiverId = chat.user1Id === senderId ? chat.user2Id : chat.user1Id;
    }

    await run(
      `INSERT INTO messages
        (id, chatId, senderId, receiverId, text, messageType, mediaUrl, mediaName, clientId, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        chatId,
        senderId,
        receiverId,
        text?.trim() || null,
        messageType,
        mediaUrl || null,
        mediaName || null,
        clientId,
      ]
    );

    // Invalide cache
    await cache.invalidateChat(chatId);
    await cache.invalidateAllChats(senderId);
    if (receiverId) await cache.invalidateAllChats(receiverId);

    const message = await this.getById(id, senderId);
    return { ...message, clientId, status: 'sent' };
  }

  static async getById(messageId, viewerId) {
    if (!messageId) return null;
    const rows = await all(
      `SELECT
         m.*,
         m.text AS content,
         m.timestamp AS createdAt,
         u.id AS senderId,
         u.name AS senderName,
         u.avatar AS senderAvatar,
         u.role AS senderRole,
         u.isSupport AS senderIsSupport,
         r.id AS receiverId,
         r.name AS receiverName,
         r.avatar AS receiverAvatar,
         mr.readAt IS NOT NULL AS isRead,
         mr.readAt
       FROM messages m
       JOIN users u ON u.id = m.senderId
       LEFT JOIN users r ON r.id = m.receiverId
       LEFT JOIN message_reads mr ON m.id = mr.messageId AND mr.userId = ?
       WHERE m.id = ?`,
      [viewerId, messageId]
    );
    if (!rows.length) return null;
    const msg = rows[0];
    return {
      ...msg,
      status: msg.isRead ? 'read' : 'sent',
      readAt: msg.readAt || null,
      clientId: msg.clientId || null,
    };
  }

  static async getByChatId(chatId, userId, limit = 50, before = null) {
    if (!chatId || !userId) return [];

    const cacheKey = `messages:${chatId}:${userId}:${limit}:${before || 'head'}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    let sql = `
      SELECT
        m.*,
        m.text AS content,
        m.timestamp AS createdAt,
        u.id AS senderId,
        u.name AS senderName,
        u.avatar AS senderAvatar,
        u.role AS senderRole,
        u.isSupport AS senderIsSupport,
        r.id AS receiverId,
        r.name AS receiverName,
        r.avatar AS receiverAvatar,
        mr.readAt IS NOT NULL AS isRead,
        mr.readAt
      FROM messages m
      JOIN users u ON u.id = m.senderId
      LEFT JOIN users r ON r.id = m.receiverId
      LEFT JOIN message_reads mr ON m.id = mr.messageId AND mr.userId = ?
      WHERE m.chatId = ?`;
    const params = [userId, chatId];
    if (before) {
      sql += ` AND m.timestamp < ?`;
      params.push(before);
    }
    sql += ` ORDER BY m.timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = await all(sql, params);
    const messages = rows.reverse().map(msg => ({
      ...msg,
      status: msg.isRead ? 'read' : 'sent',
      readAt: msg.readAt || null,
      clientId: msg.clientId || null,
    }));

    await cache.set(cacheKey, messages, 300); // 5 min
    return messages;
  }

  static async getLatestByChatId(chatId) {
    if (!chatId) return null;
    const rows = await all(
      `SELECT
         m.*,
         m.text AS content,
         m.timestamp AS createdAt,
         u.name AS senderName,
         u.avatar AS senderAvatar
       FROM messages m
       JOIN users u ON u.id = m.senderId
       WHERE m.chatId = ?
       ORDER BY m.timestamp DESC LIMIT 1`,
      [chatId]
    );
    if (!rows.length) return null;
    const msg = rows[0];
    return { ...msg, status: 'sent', readAt: null, clientId: msg.clientId || null };
  }

  static async getByClientId(clientId) {
    if (!clientId) return null;
    const rows = await all(
      `SELECT m.*, u.name AS senderName, u.avatar AS senderAvatar
       FROM messages m
       JOIN users u ON u.id = m.senderId
       WHERE m.clientId = ? LIMIT 1`,
      [clientId]
    );
    return rows[0] || null;
  }

  static async markAsReadBatch(messageIds, userId) {
    if (!Array.isArray(messageIds) || messageIds.length === 0 || !userId) return;
    const placeholders = messageIds.map(() => '(?, ?, NOW())').join(', ');
    const params = messageIds.flatMap(id => [id, userId]);
    await run(
      `INSERT INTO message_reads (messageId, userId, readAt)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE readAt = NOW()`,
      params
    );
    await cache.invalidate(`messages:*${userId}*`);
    await cache.invalidateAllChats(userId);
  }

  static async getUnreadCount(chatId, userId) {
    if (!chatId || !userId) return 0;
    const cached = await cache.getUnreadCount(chatId, userId);
    if (cached !== null) return cached;

    const [row] = await all(
      `SELECT COUNT(*) AS count
       FROM messages m
       LEFT JOIN message_reads mr ON m.id = mr.messageId AND mr.userId = ?
       WHERE m.chatId = ? AND m.receiverId = ? AND mr.messageId IS NULL`,
      [userId, chatId, userId]
    );
    const count = Number(row?.count || 0);
    await cache.setUnreadCount(chatId, userId, count);
    return count;
  }

  static async delete(messageId) {
    if (!messageId) return false;
    const msg = await all(`SELECT chatId FROM messages WHERE id = ?`, [messageId]);
    if (!msg.length) return false;
    await run(`DELETE FROM message_reads WHERE messageId = ?`, [messageId]);
    await run(`DELETE FROM messages WHERE id = ?`, [messageId]);
    await cache.invalidate(`messages:*${msg[0].chatId}*`);
    return true;
  }

  static async exists(messageId) {
    if (!messageId) return false;
    const [row] = await all(`SELECT 1 FROM messages WHERE id = ? LIMIT 1`, [messageId]);
    return !!row;
  }
}

module.exports = Message;