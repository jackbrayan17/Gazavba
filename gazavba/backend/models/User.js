const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
};

class User {
  static async create(userData) {
    const {
      id = uuidv4(),
      name,
      email,
      phone,
      avatar = null,
      password = null,
      role = 'user',
      isSuperAdmin = false,
    } = userData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, name, email, phone, avatar, password, role, isSuperAdmin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          email,
          phone,
          avatar,
          password,
          role,
          isSuperAdmin ? 1 : 0,
        ],
        function(err) {
          if (err) reject(err);
          else resolve(sanitizeUser({ id, ...userData }));
        }
      );
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(sanitizeUser(row));
      });
    });
  }

  static async getByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByPhone(phone) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE phone = ?`, [phone], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    if (fields.length === 0) {
      return this.getById(id);
    }

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [...values, id],
        function(err) {
          if (err) reject(err);
          else User.getById(id).then(resolve).catch(reject);
        }
      );
    });
  }

  static async setOnlineStatus(id, isOnline) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET isOnline = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?`,
        [isOnline ? 1 : 0, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, email, phone, avatar, role, isSuperAdmin, isOnline, lastSeen, createdAt, updatedAt
         FROM users ORDER BY name`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async search(query) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, email, phone, avatar, role, isSuperAdmin, isOnline, lastSeen, createdAt, updatedAt
         FROM users WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?`,
        [`%${query}%`, `%${query}%`, `%${query}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = User;
