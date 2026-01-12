/* eslint-env node */
const { run, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { cache } = require('../config/cache');

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function formatDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const Y = dt.getFullYear();
  const M = pad2(dt.getMonth() + 1);
  const D = pad2(dt.getDate());
  const h = pad2(dt.getHours());
  const m = pad2(dt.getMinutes());
  const s = pad2(dt.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

class Status {
  static async create(statusData) {
    const { userId, type = 'text', content = null, mediaUrl = null, expiresAt = null } = statusData;
    if (!userId) throw new Error('Status.create: userId est requis');
    const id = uuidv4();
    const expires = expiresAt ? (expiresAt instanceof Date ? formatDateTime(expiresAt) : String(expiresAt)) : null;

    await run(
      `INSERT INTO statuses (id, userId, type, content, mediaUrl, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, String(type || 'text'), content, mediaUrl, expires]
    );
    await cache.invalidate(`status:*`);

    const rows = await all(
      `SELECT s.*, u.name AS userName, u.avatar AS userAvatar, u.statusPrivacy
         FROM statuses s
         JOIN users u ON u.id = s.userId
        WHERE s.id = ?
        LIMIT 1`,
      [id]
    );
    return rows?.[0] || { id, userId, type, content, mediaUrl, expiresAt: expires, createdAt: formatDateTime(new Date()) };
  }

  static async getByUserId(userId) {
    const cached = await cache.get(`status:user:${userId}`);
    if (cached) return cached;
    const rows = await all(
      `SELECT s.*, u.name AS userName, u.avatar AS userAvatar, u.statusPrivacy
         FROM statuses s
         JOIN users u ON s.userId = u.id
        WHERE s.userId = ?
          AND (s.expiresAt IS NULL OR s.expiresAt > NOW())
        ORDER BY s.createdAt DESC`,
      [userId]
    );
    await cache.set(`status:user:${userId}`, rows, 60);
    return rows;
  }

  // MAIN: Get statuses visible to viewerUserId
  static async getAll(viewerUserId) {
    const cached = await cache.get(`status:all:${viewerUserId}`);
    if (cached) return cached;

    const rows = await all(`
      SELECT 
        s.*,
        u.name AS userName,
        u.avatar AS userAvatar,
        u.statusPrivacy,
        (SELECT COUNT(*) FROM status_views sv WHERE sv.statusId = s.id) AS viewCount,
        EXISTS(SELECT 1 FROM status_views sv WHERE sv.statusId = s.id AND sv.viewerId = ?) AS hasViewed
      FROM statuses s
      JOIN users u ON s.userId = u.id
      WHERE (s.expiresAt IS NULL OR s.expiresAt > NOW())
        AND (
          u.statusPrivacy = 'general'
          OR s.userId = ?
          OR EXISTS (
            SELECT 1 FROM contacts c
            WHERE (c.ownerId = ? AND c.hasAccountUserId = s.userId)
               OR (c.ownerId = s.userId AND c.hasAccountUserId = ?)
          )
        )
      ORDER BY s.createdAt DESC
    `, [viewerUserId, viewerUserId, viewerUserId, viewerUserId]);

    await cache.set(`status:all:${viewerUserId}`, rows, 30);
    return rows;
  }

  static async markAsViewed(statusId, viewerId) {
    if (!statusId || !viewerId) return { ok: false };
    const id = uuidv4();
    await run(
      `INSERT INTO status_views (id, statusId, viewerId, viewedAt)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE viewedAt = NOW()`,
      [id, statusId, viewerId]
    );
    await cache.invalidate(`status:all:*`);
    return { ok: true };
  }

  static async getViewers(statusId, opts = {}) {
    const order = String(opts.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = Number.isFinite(opts.offset) ? Math.max(0, opts.offset) : 0;
    const limitClause = Number.isFinite(opts.limit) && opts.limit > 0 ? ` LIMIT ${opts.limit} OFFSET ${offset}` : '';
    const rows = await all(
      `SELECT
          u.id, u.name, u.email, u.phone, u.avatar, u.role, u.isSuperAdmin, u.isOnline, u.lastSeen,
          sv.viewedAt
         FROM users u
         JOIN status_views sv ON u.id = sv.viewerId
        WHERE sv.statusId = ?
        ORDER BY sv.viewedAt ${order}${limitClause}`,
      [statusId]
    );
    return (rows || []).map(r => ({
      user: {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        avatar: r.avatar,
        role: r.role,
        isSuperAdmin: !!r.isSuperAdmin,
        isOnline: !!r.isOnline,
        lastSeen: r.lastSeen ? new Date(r.lastSeen).toISOString() : null,
      },
      viewedAt: r.viewedAt ? new Date(r.viewedAt).toISOString() : null,
    }));
  }

  static async delete(id) {
    await run(`DELETE FROM statuses WHERE id = ?`, [id]);
    await cache.invalidate(`status:*`);
    return { ok: true };
  }

  static async getUnseenCount(userId) {
    const cached = await cache.get(`status:unseen:${userId}`);
    if (cached !== null) return cached;

    const [row] = await all(`
      SELECT COUNT(*) AS count
      FROM statuses s
      JOIN users u ON s.userId = u.id
      WHERE s.userId <> ?
        AND (s.expiresAt IS NULL OR s.expiresAt > NOW())
        AND (
          u.statusPrivacy = 'general'
          OR EXISTS (
            SELECT 1 FROM contacts c
            WHERE (c.ownerId = ? AND c.hasAccountUserId = s.userId)
               OR (c.ownerId = s.userId AND c.hasAccountUserId = ?)
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM status_views sv
          WHERE sv.statusId = s.id AND sv.viewerId = ?
        )
    `, [userId, userId, userId, userId]);

    const count = row?.count || 0;
    await cache.set(`status:unseen:${userId}`, count, 60);
    return count;
  }
}

module.exports = Status;