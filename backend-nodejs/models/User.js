/* eslint-env node */
const { all, run } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Chat = require('./Chat');

const normalizePhone = (v = '') => (v ?? '').toString().replace(/[^\d+]/g, '').trim();

const sanitizeUser = (row) => {
  if (!row) return null;
  const { password, ...safe } = row;
  safe.isOnline = !!safe.isOnline;
  safe.isVerified = !!safe.isVerified;
  safe.isSuperAdmin = !!safe.isSuperAdmin;
  safe.isSupport = !!safe.isSupport;
  return safe;
};

class User {
  static async create(data) {
    const id = data.id || uuidv4();
    const payload = {
      id,
      name: data.name ?? null,
      email: (data.email ?? '').trim().toLowerCase() || null,
      phone: normalizePhone(data.phone ?? ''),
      avatar: data.avatar ?? null,
      bio: data.bio ?? null,
      password: data.password ?? null,
      role: data.role ?? 'user',
      isSuperAdmin: data.isSuperAdmin ? 1 : 0,
      isVerified: data.isVerified ? 1 : 0,
      isSupport: data.isSupport ? 1 : 0,
      backgroundGlobal: data.backgroundGlobal ?? null,
      statusPrivacy: data.statusPrivacy ?? 'private', // ← NEW: default private
    };

    await run(
      `INSERT INTO users
       (id, name, email, phone, avatar, bio, password, role, isSuperAdmin, isVerified, isSupport, backgroundGlobal, statusPrivacy, isOnline, lastSeen, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        payload.id, payload.name, payload.email, payload.phone, payload.avatar, payload.bio,
        payload.password, payload.role, payload.isSuperAdmin, payload.isVerified, payload.isSupport,
        payload.backgroundGlobal, payload.statusPrivacy,
      ]
    );
    return this.getById(id);
  }

  static async getById(id) {
    const [row] = await all(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
    return sanitizeUser(row);
  }

  static async getByEmail(email) {
    const [row] = await all(
      `SELECT * FROM users WHERE email = ? LIMIT 1`,
      [(email ?? '').trim().toLowerCase()]
    );
    return row || null;
  }

  static async getByPhone(phone) {
    const [row] = await all(`SELECT * FROM users WHERE phone = ? LIMIT 1`, [normalizePhone(phone)]);
    return row || null;
  }

  static async update(id, updates = {}) {
    if (!id) throw new Error('User id required');
    const payload = { ...updates };

    if (payload.email !== undefined) payload.email = (payload.email ?? '').trim().toLowerCase() || null;
    if (payload.phone !== undefined) payload.phone = normalizePhone(payload.phone);
    if (payload.isSuperAdmin !== undefined) payload.isSuperAdmin = updates.isSuperAdmin ? 1 : 0;
    if (payload.isOnline !== undefined) payload.isOnline = updates.isOnline ? 1 : 0;
    if (payload.isVerified !== undefined) payload.isVerified = updates.isVerified ? 1 : 0;
    if (payload.isSupport !== undefined) payload.isSupport = updates.isSupport ? 1 : 0;
    if (payload.bio !== undefined) payload.bio = (updates.bio ?? '').trim() || null;
    if (payload.statusPrivacy !== undefined) {
      if (!['private', 'general'].includes(updates.statusPrivacy)) {
        throw new Error('statusPrivacy must be "private" or "general"');
      }
      payload.statusPrivacy = updates.statusPrivacy;
    }

    const fields = Object.keys(payload);
    if (!fields.length) return this.getById(id);

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => payload[f]);

    await run(`UPDATE users SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);
    return this.getById(id);
  }

  static async setOnlineStatus(id, isOnline) {
    await run(
      `UPDATE users SET isOnline = ?, lastSeen = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [isOnline ? 1 : 0, id]
    );
  }

  static async getAll() {
    const rows = await all(
      `SELECT id, name, email, phone, avatar, bio, role, isSuperAdmin, isVerified, isSupport, backgroundGlobal, statusPrivacy, isOnline, lastSeen, createdAt, updatedAt
         FROM users ORDER BY name IS NULL, LOWER(name) ASC`
    );
    return rows.map(sanitizeUser);
  }

  static async search(query) {
    const q = `%${query ?? ''}%`;
    const rows = await all(
      `SELECT id, name, email, phone, avatar, bio, role, isSuperAdmin, isVerified, isSupport, backgroundGlobal, statusPrivacy, isOnline, lastSeen, createdAt, updatedAt
         FROM users
        WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR bio LIKE ?
        ORDER BY name IS NULL, LOWER(name) ASC`,
      [q, q, q, q]
    );
    return rows.map(sanitizeUser);
  }

  static async getByPhones(phones = []) {
    const normalized = Array.from(new Set((phones || []).map(normalizePhone).filter(Boolean)));
    if (!normalized.length) return [];
    const placeholders = normalized.map(() => '?').join(',');
    const rows = await all(
      `SELECT id, name, email, phone, avatar, bio, role, isSuperAdmin, isVerified, isSupport, backgroundGlobal, statusPrivacy, isOnline, lastSeen, createdAt, updatedAt
         FROM users WHERE phone IN (${placeholders})`,
      normalized
    );
    return rows.map(sanitizeUser);
  }

  // Background methods (unchanged)
  static async setGlobalBackground(userId, background) {
    if (!userId) throw new Error('userId required');
    await run(`UPDATE users SET backgroundGlobal = ? WHERE id = ?`, [background, userId]);
    return { userId, backgroundGlobal: background };
  }

  static async getGlobalBackground(userId) {
    const [row] = await all(`SELECT backgroundGlobal FROM users WHERE id = ? LIMIT 1`, [userId]);
    return row?.backgroundGlobal || null;
  }

  static async setChatBackground(userId, chatId, background) {
    if (!userId || !chatId) throw new Error('userId and chatId required');
    const chat = await Chat.getById(chatId);
    if (!chat) throw new Error('CHAT_NOT_FOUND');
    if (!(await Chat.isParticipant(chatId, userId))) throw new Error('FORBIDDEN');
    if (background === null) {
      await run(`DELETE FROM user_chat_settings WHERE userId = ? AND chatId = ?`, [userId, chatId]);
      return { userId, chatId, background: null };
    }
    const id = uuidv4();
    await run(
      `INSERT INTO user_chat_settings (id, userId, chatId, background)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE background = VALUES(background)`,
      [id, userId, chatId, background]
    );
    return { id, userId, chatId, background };
  }

  static async clearChatBackground(userId, chatId) {
    await run(`DELETE FROM user_chat_settings WHERE userId = ? AND chatId = ?`, [userId, chatId]);
    return { userId, chatId, background: null };
  }

  static async getChatOverride(userId, chatId) {
    const [row] = await all(
      `SELECT background FROM user_chat_settings WHERE userId = ? AND chatId = ? LIMIT 1`,
      [userId, chatId]
    );
    return row?.background || null;
  }

  static async getEffectiveBackground(userId, chatId) {
    if (!userId || !chatId) return null;
    const override = await this.getChatOverride(userId, chatId);
    if (override) return override;
    return await this.getGlobalBackground(userId);
  }

  static async getAllChatOverrides(userId) {
    const rows = await all(
      `SELECT chatId, background FROM user_chat_settings WHERE userId = ?`,
      [userId]
    );
    return rows.reduce((acc, r) => {
      acc[r.chatId] = r.background;
      return acc;
    }, {});
  }
}

module.exports = User;