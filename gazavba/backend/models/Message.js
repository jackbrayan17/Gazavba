const { run, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Message {
  static async create(messageData) {
    const {
      chatId,
      senderId,
      text,
      messageType = 'text',
      mediaUrl,
      mediaName = null,
    } = messageData;
    const id = uuidv4();

    await run(
      `INSERT INTO messages (id, chatId, senderId, text, messageType, mediaUrl, mediaName) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, chatId, senderId, text, messageType, mediaUrl, mediaName]
    );
    return { id, ...messageData, timestamp: new Date() };
  }

  static async getByChatId(chatId, limit = 50, offset = 0) {
    const rows = await all(
      `SELECT m.*, u.name as senderName, u.avatar as senderAvatar
         FROM messages m
         JOIN users u ON m.senderId = u.id
         WHERE m.chatId = ?
         ORDER BY m.timestamp DESC
         LIMIT ? OFFSET ?`,
      [chatId, limit, offset]
    );
    return Array.isArray(rows) ? rows.reverse() : rows;
  }

  static async markAsRead(messageId, userId) {
    await run(
      `INSERT OR IGNORE INTO message_reads (id, messageId, userId) VALUES (?, ?, ?)`,
      [uuidv4(), messageId, userId]
    );
  }

  static async markChatAsRead(chatId, userId) {
    await run(
      `UPDATE messages SET isRead = 1
         WHERE chatId = ? AND senderId != ?`,
      [chatId, userId]
    );
  }

  static async getUnreadCount(chatId, userId) {
    const rows = await all(
      `SELECT COUNT(*) as count FROM messages
         WHERE chatId = ? AND senderId != ? AND isRead = 0`,
      [chatId, userId]
    );
    const result = Array.isArray(rows) ? rows[0] : rows;
    return result?.count ?? 0;
  }

  static async delete(id) {
    await run(`DELETE FROM messages WHERE id = ?`, [id]);
  }
}

module.exports = Message;
