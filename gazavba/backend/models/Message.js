const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Message {
  static async create(messageData) {
    const { chatId, senderId, text, messageType = 'text', mediaUrl } = messageData;
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO messages (id, chatId, senderId, text, messageType, mediaUrl) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, chatId, senderId, text, messageType, mediaUrl],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...messageData, timestamp: new Date() });
        }
      );
    });
  }

  static async getByChatId(chatId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.name as senderName, u.avatar as senderAvatar 
         FROM messages m 
         JOIN users u ON m.senderId = u.id 
         WHERE m.chatId = ? 
         ORDER BY m.timestamp DESC 
         LIMIT ? OFFSET ?`,
        [chatId, limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.reverse()); // Return in chronological order
        }
      );
    });
  }

  static async markAsRead(messageId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO message_reads (id, messageId, userId) VALUES (?, ?, ?)`,
        [uuidv4(), messageId, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async markChatAsRead(chatId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE messages SET isRead = 1 
         WHERE chatId = ? AND senderId != ?`,
        [chatId, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async getUnreadCount(chatId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM messages 
         WHERE chatId = ? AND senderId != ? AND isRead = 0`,
        [chatId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM messages WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = Message;
