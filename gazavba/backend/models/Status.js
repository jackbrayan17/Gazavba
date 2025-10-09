const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Status {
  static async create(statusData) {
    const { userId, type = 'text', content, mediaUrl, expiresAt } = statusData;
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO statuses (id, userId, type, content, mediaUrl, expiresAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, type, content, mediaUrl, expiresAt],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...statusData, createdAt: new Date() });
        }
      );
    });
  }

  static async getByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT s.*, u.name as userName, u.avatar as userAvatar 
         FROM statuses s 
         JOIN users u ON s.userId = u.id 
         WHERE s.userId = ? AND (s.expiresAt IS NULL OR s.expiresAt > datetime('now')) 
         ORDER BY s.createdAt DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getAll(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT s.*, u.name as userName, u.avatar as userAvatar,
         (SELECT COUNT(*) FROM status_views sv WHERE sv.statusId = s.id) as viewCount,
         (SELECT COUNT(*) FROM status_views sv WHERE sv.statusId = s.id AND sv.viewerId = ?) as hasViewed
         FROM statuses s 
         JOIN users u ON s.userId = u.id 
         WHERE (s.expiresAt IS NULL OR s.expiresAt > datetime('now')) 
         ORDER BY s.createdAt DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async markAsViewed(statusId, viewerId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO status_views (id, statusId, viewerId) VALUES (?, ?, ?)`,
        [uuidv4(), statusId, viewerId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async getViewers(statusId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.*, sv.viewedAt FROM users u 
         JOIN status_views sv ON u.id = sv.viewerId 
         WHERE sv.statusId = ? 
         ORDER BY sv.viewedAt DESC`,
        [statusId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM statuses WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static async getUnseenCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM statuses s 
         WHERE s.userId != ? AND (s.expiresAt IS NULL OR s.expiresAt > datetime('now'))
         AND NOT EXISTS (SELECT 1 FROM status_views sv WHERE sv.statusId = s.id AND sv.viewerId = ?)`,
        [userId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
  }
}

module.exports = Status;
