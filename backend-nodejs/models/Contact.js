/* eslint-env node */
const { v4: uuidv4 } = require('uuid');
const { all, run } = require('../config/database');

const normalizePhone = (value = '') => {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return '+' + s.replace(/[^\d]/g, '');
  return s.replace(/[^\d]/g, '');
};

class Contact {
  /**
   * Save one contact (UPSERT). Links to user account if phone matches.
   * @returns {Promise<object[]>} refreshed list for owner
   */
  static async upsertOne(ownerId, raw = {}) {
    const phone = normalizePhone(raw.phone || raw.number || raw.phoneNumber || '');
    if (!phone) return this.list(ownerId);

    const name = (raw.name || phone).toString();
    const avatar = raw.avatar || raw.avatarUrl || null;
    const lastInteraction = raw.lastInteraction || null;

    const user = await all(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [phone]);
    const hasAccountUserId = user?.[0]?.id || null;

    await run(
      `INSERT INTO contacts (id, ownerId, name, phone, avatar, hasAccountUserId, lastInteraction)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name              = COALESCE(NULLIF(VALUES(name), ''), contacts.name),
         avatar            = COALESCE(NULLIF(VALUES(avatar), ''), contacts.avatar),
         hasAccountUserId  = VALUES(hasAccountUserId),
         lastInteraction   = COALESCE(VALUES(lastInteraction), contacts.lastInteraction),
         updatedAt         = CURRENT_TIMESTAMP`,
      [uuidv4(), ownerId, name, phone, avatar, hasAccountUserId, lastInteraction]
    );

    return this.list(ownerId);
  }

  static async upsertMany(ownerId, rawContacts = []) {
    const prepared = [];
    const seen = new Set();

    const push = (entry) => {
      if (!entry) return;

      if (typeof entry === 'string') {
        const phone = normalizePhone(entry);
        if (phone && !seen.has(phone)) {
          seen.add(phone);
          prepared.push({ name: phone, phone, avatar: null, lastInteraction: null });
        }
        return;
      }

      if (typeof entry === 'object') {
        const phone = normalizePhone(entry.phone || entry.number || entry.phoneNumber);
        if (!phone || seen.has(phone)) return;
        seen.add(phone);
        prepared.push({
          name: (entry.name || phone).toString(),
          phone,
          avatar: entry.avatar || entry.avatarUrl || null,
          lastInteraction: entry.lastInteraction || null,
        });
      }
    };

    rawContacts.forEach(push);
    if (!prepared.length) return [];

    // link to accounts
    const phones = prepared.map((c) => c.phone);
    const placeholders = phones.map(() => '?').join(',');
    const users = await all(
      `SELECT id, phone FROM users WHERE phone IN (${placeholders})`,
      phones
    );
    const userByPhone = new Map((users || []).map((u) => [normalizePhone(u.phone), u.id]));

    for (const c of prepared) {
      const hasAccountUserId = userByPhone.get(c.phone) || null;
      await run(
        `INSERT INTO contacts (id, ownerId, name, phone, avatar, hasAccountUserId, lastInteraction)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name              = COALESCE(NULLIF(VALUES(name), ''), contacts.name),
           avatar            = COALESCE(NULLIF(VALUES(avatar), ''), contacts.avatar),
           hasAccountUserId  = VALUES(hasAccountUserId),
           lastInteraction   = COALESCE(VALUES(lastInteraction), contacts.lastInteraction),
           updatedAt         = CURRENT_TIMESTAMP`,
        [uuidv4(), ownerId, c.name, c.phone, c.avatar, hasAccountUserId, c.lastInteraction]
      );
    }

    return this.list(ownerId);
  }

  static async list(ownerId) {
    return all(
      `SELECT
         c.id, c.ownerId, c.name, c.phone, c.avatar,
         c.hasAccountUserId,
         CASE WHEN c.hasAccountUserId IS NULL THEN 0 ELSE 1 END AS hasAccount,
         c.isMuted, c.isBlocked, c.lastInteraction,
         u.name    AS accountName,
         u.avatar  AS accountAvatar,
         u.isOnline,
         u.lastSeen,
         c.createdAt, c.updatedAt
       FROM contacts c
       LEFT JOIN users u ON u.id = c.hasAccountUserId
       WHERE c.ownerId = ?
       ORDER BY c.name IS NULL, LOWER(c.name) ASC, c.createdAt DESC`,
      [ownerId]
    );
  }

  static async setMute(ownerId, targetUserId, isMuted) {
    await run(
      `UPDATE contacts
          SET isMuted = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE ownerId = ? AND hasAccountUserId = ?`,
      [isMuted ? 1 : 0, ownerId, targetUserId]
    );
    return this.list(ownerId);
  }

  static async setBlock(ownerId, targetUserId, isBlocked) {
    await run(
      `UPDATE contacts
          SET isBlocked = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE ownerId = ? AND hasAccountUserId = ?`,
      [isBlocked ? 1 : 0, ownerId, targetUserId]
    );
    return this.list(ownerId);
  }
}

module.exports = Contact;
