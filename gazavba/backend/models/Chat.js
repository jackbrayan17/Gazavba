const { run, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Chat {
  static async create(chatData) {
    const { name, type = 'direct', createdBy, participants } = chatData;
    const id = uuidv4();
    await run(`INSERT INTO chats (id, name, type, createdBy) VALUES (?, ?, ?, ?)`, [
      id,
      name,
      type,
      createdBy,
    ]);

    if (participants && participants.length > 0) {
      for (const userId of participants) {
        const participantId = uuidv4();
        await run(
          `INSERT INTO chat_participants (id, chatId, userId) VALUES (?, ?, ?)`,
          [participantId, id, userId]
        );
      }
    }

    return { id, ...chatData };
  }

  static async getById(id) {
    const rows = await all(`SELECT * FROM chats WHERE id = ?`, [id]);
    return Array.isArray(rows) ? rows[0] : rows;
  }

  static async getByUserId(userId) {
    return all(
      `SELECT DISTINCT c.*, cp.isMuted as isMuted, cp.muteUntil as muteUntil,
        (SELECT text FROM messages WHERE chatId = c.id ORDER BY timestamp DESC LIMIT 1) as lastMessage,
        (SELECT timestamp FROM messages WHERE chatId = c.id ORDER BY timestamp DESC LIMIT 1) as lastMessageTime,
        (SELECT COUNT(*) FROM messages m WHERE m.chatId = c.id AND m.senderId != ? AND m.isRead = 0) as unreadCount
       FROM chats c
       JOIN chat_participants cp ON c.id = cp.chatId
       WHERE cp.userId = ?
       ORDER BY lastMessageTime DESC`,
      [userId, userId]
    );
  }

  static async getParticipants(chatId) {
    return all(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.role, u.isSuperAdmin, u.isOnline, u.lastSeen, cp.userId, cp.joinedAt,
        cp.isMuted, cp.muteUntil
       FROM users u
       JOIN chat_participants cp ON u.id = cp.userId
       WHERE cp.chatId = ?`,
      [chatId]
    );
  }

  static async addParticipant(chatId, userId) {
    const participantId = uuidv4();
    await run(`INSERT INTO chat_participants (id, chatId, userId) VALUES (?, ?, ?)`, [
      participantId,
      chatId,
      userId,
    ]);
    return { id: participantId, chatId, userId };
  }

  static async removeParticipant(chatId, userId) {
    await run(`DELETE FROM chat_participants WHERE chatId = ? AND userId = ?`, [chatId, userId]);
  }

  static async getDirectChat(userId1, userId2) {
    const rows = await all(
      `SELECT c.* FROM chats c
         JOIN chat_participants cp1 ON c.id = cp1.chatId
         JOIN chat_participants cp2 ON c.id = cp2.chatId
         WHERE c.type = 'direct' AND cp1.userId = ? AND cp2.userId = ?`,
      [userId1, userId2]
    );
    return Array.isArray(rows) ? rows[0] : rows;
  }

  static async getParticipantSettings(chatId, userId) {
    const rows = await all(
      `SELECT * FROM chat_participants WHERE chatId = ? AND userId = ? LIMIT 1`,
      [chatId, userId]
    );
    return Array.isArray(rows) ? rows[0] : rows;
  }

  static async updateParticipantSettings(chatId, userId, updates = {}) {
    const fields = Object.keys(updates);
    if (fields.length === 0) return this.getParticipantSettings(chatId, userId);
    const assignments = fields.map((field) => `${field} = ?`).join(', ');
    const values = Object.values(updates);
    await run(
      `UPDATE chat_participants SET ${assignments} WHERE chatId = ? AND userId = ?`,
      [...values, chatId, userId]
    );
    return this.getParticipantSettings(chatId, userId);
  }

  static async setMute(chatId, userId, { muteUntil = null, isMuted = true } = {}) {
    await this.updateParticipantSettings(chatId, userId, {
      isMuted: isMuted ? 1 : 0,
      muteUntil,
    });
    return this.getParticipantSettings(chatId, userId);
  }
}

module.exports = Chat;
