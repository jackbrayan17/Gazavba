/* eslint-env node */
const { run, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Call {
  static async create(data) {
    const { callerId, receiverId, chatId, type = 'audio' } = data;
    const id = uuidv4();
    await run(
      `INSERT INTO calls (id, callerId, receiverId, chatId, type, status, startedAt)
       VALUES (?, ?, ?, ?, ?, 'initiated', CURRENT_TIMESTAMP)`,
      [id, callerId, receiverId, chatId, type]
    );
    return this.getById(id);
  }

  static async getById(id) {
    const [row] = await all(`SELECT * FROM calls WHERE id = ? LIMIT 1`, [id]);
    return row;
  }

  static async updateStatus(id, status) {
    await run(`UPDATE calls SET status = ?, endedAt = ? WHERE id = ?`, [
      status,
      ['ended', 'missed', 'rejected'].includes(status) ? new Date() : null,
      id,
    ]);
    return this.getById(id);
  }

  static async getHistory(userId, limit = 50) {
    const rows = await all(
      `SELECT c.*, 
              u.name as otherName, u.avatar as otherAvatar
         FROM calls c
         LEFT JOIN users u ON (c.callerId = u.id AND c.callerId != ?) OR (c.receiverId = u.id AND c.receiverId != ?)
        WHERE c.callerId = ? OR c.receiverId = ?
        ORDER BY c.startedAt DESC LIMIT ?`,
      [userId, userId, userId, userId, limit]
    );
    return rows;
  }
}

module.exports = Call;
