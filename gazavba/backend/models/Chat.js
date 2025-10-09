const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Chat {
  static async create(chatData) {
    const { name, type = 'direct', createdBy, participants } = chatData;
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Create chat
        db.run(
          `INSERT INTO chats (id, name, type, createdBy) VALUES (?, ?, ?, ?)`,
          [id, name, type, createdBy],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            
            // Add participants
            if (participants && participants.length > 0) {
              const participantInserts = participants.map(userId => {
                const participantId = uuidv4();
                return new Promise((resolvePart, rejectPart) => {
                  db.run(
                    `INSERT INTO chat_participants (id, chatId, userId) VALUES (?, ?, ?)`,
                    [participantId, id, userId],
                    function(err) {
                      if (err) rejectPart(err);
                      else resolvePart();
                    }
                  );
                });
              });
              
              Promise.all(participantInserts)
                .then(() => resolve({ id, ...chatData }))
                .catch(reject);
            } else {
              resolve({ id, ...chatData });
            }
          }
        );
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM chats WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT c.*, 
         (SELECT text FROM messages WHERE chatId = c.id ORDER BY timestamp DESC LIMIT 1) as lastMessage,
         (SELECT timestamp FROM messages WHERE chatId = c.id ORDER BY timestamp DESC LIMIT 1) as lastMessageTime,
         (SELECT COUNT(*) FROM messages m WHERE m.chatId = c.id AND m.senderId != ? AND m.isRead = 0) as unreadCount
         FROM chats c 
         JOIN chat_participants cp ON c.id = cp.chatId 
         WHERE cp.userId = ? 
         ORDER BY lastMessageTime DESC`,
        [userId, userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getParticipants(chatId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.role, u.isSuperAdmin, u.isOnline, u.lastSeen, cp.userId, cp.joinedAt
         FROM users u
         JOIN chat_participants cp ON u.id = cp.userId
         WHERE cp.chatId = ?`,
        [chatId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async addParticipant(chatId, userId) {
    const participantId = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO chat_participants (id, chatId, userId) VALUES (?, ?, ?)`,
        [participantId, chatId, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ id: participantId, chatId, userId });
        }
      );
    });
  }

  static async removeParticipant(chatId, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM chat_participants WHERE chatId = ? AND userId = ?`,
        [chatId, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async getDirectChat(userId1, userId2) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT c.* FROM chats c 
         JOIN chat_participants cp1 ON c.id = cp1.chatId 
         JOIN chat_participants cp2 ON c.id = cp2.chatId 
         WHERE c.type = 'direct' AND cp1.userId = ? AND cp2.userId = ?`,
        [userId1, userId2],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

module.exports = Chat;
