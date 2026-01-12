/* eslint-env node */
const { run, all, get } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { cache } = require('../config/cache'); // UPSTASH REDIS
const MAX_GROUP_PARTICIPANTS = 255;

/* ==================== UTILS ==================== */
async function getParticipantCount(chatId) {
  const [row] = await all(`SELECT COUNT(*) AS c FROM chat_participants WHERE chatId = ?`, [chatId]);
  return Number(row?.c || 0);
}

async function isParticipant(chatId, userId) {
  const [row] = await all(`SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ? LIMIT 1`, [chatId, userId]);
  return !!row;
}

async function isAdmin(chatId, userId) {
  const [row] = await all(`SELECT 1 FROM chat_participants WHERE chatId = ? AND userId = ? AND isAdmin = 1 LIMIT 1`, [chatId, userId]);
  return !!row;
}

async function ensureCapacity(chatId, addCount) {
  const current = chatId ? await getParticipantCount(chatId) : 0;
  if (current + addCount > MAX_GROUP_PARTICIPANTS) {
    const e = new Error('GROUP_LIMIT_EXCEEDED');
    e.code = 'GROUP_LIMIT_EXCEEDED';
    e.limit = MAX_GROUP_PARTICIPANTS;
    e.current = current;
    e.addCount = addCount;
    throw e;
  }
}

/* ==================== CHAT CLASS ==================== */
class Chat {
  // --- 1-TO-1 CHATS: FK SAFE + DEDUPLICATION ---
  static async ensureDirectChatBetween(userA, userB, createdBy = userA) {
    if (!userA || !userB) throw new Error('MISSING_USER_IDS');
    if (String(userA) === String(userB)) throw new Error('CANNOT_CHAT_WITH_SELF');

    const [u1, u2] = [String(userA), String(userB)].sort();

    const [user1, user2] = await Promise.all([
      get(`SELECT id FROM users WHERE id = ?`, [u1]),
      get(`SELECT id FROM users WHERE id = ?`, [u2]),
    ]);

    if (!user1 || !user2) {
      throw new Error(`User not found: ${!user1 ? u1 : u2}`);
    }

    const [existing] = await all(
      `SELECT id FROM chats WHERE type = 'direct' AND user1Id = ? AND user2Id = ? LIMIT 1`,
      [u1, u2]
    );

    if (existing) {
      const chatId = existing.id;
      await run(
        `INSERT IGNORE INTO chat_participants (id, chatId, userId, joinedAt, isMuted, isAdmin)
         VALUES (?, ?, ?, NOW(), 0, 0), (?, ?, ?, NOW(), 0, 0)`,
        [uuidv4(), chatId, userA, uuidv4(), chatId, userB]
      );
      return chatId;
    }

    const chatId = uuidv4();
    await run(
      `INSERT INTO chats (id, type, user1Id, user2Id, createdBy, createdAt)
       VALUES (?, 'direct', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [chatId, u1, u2, createdBy]
    );

    await run(
      `INSERT INTO chat_participants (id, chatId, userId, joinedAt, isMuted, isAdmin)
       VALUES (?, ?, ?, NOW(), 0, 0), (?, ?, ?, NOW(), 0, 0)`,
      [uuidv4(), chatId, userA, uuidv4(), chatId, userB]
    );

    await cache.invalidateAllChats(userA);
    await cache.invalidateAllChats(userB);

    return chatId;
  }

  static async ensureDirect(userA, userB) {
    return this.ensureDirectChatBetween(userA, userB);
  }

  static async getDirectBetween(userA, userB) {
    const [u1, u2] = [String(userA), String(userB)].sort();
    const [row] = await all(
      `SELECT id FROM chats WHERE type = 'direct' AND user1Id = ? AND user2Id = ? LIMIT 1`,
      [u1, u2]
    );
    return row?.id || null;
  }

  // --- GROUPS ---
  static async createGroup({ name, createdBy, participants = [], admins = [], avatar = null, background = null }) {
    if (!name?.trim() || !createdBy) {
      const e = new Error('INVALID_INPUT'); e.code = 'INVALID_INPUT'; throw e;
    }

    const uniqParticipants = Array.from(new Set([String(createdBy), ...participants.map(String)])).filter(Boolean);
    await ensureCapacity(null, uniqParticipants.length);

    const chatId = uuidv4();
    await run(
      `INSERT INTO chats (id, name, type, avatar, background, createdBy, createdAt)
       VALUES (?, ?, 'group', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [chatId, name.trim(), avatar, background, createdBy]
    );

    const participantValues = uniqParticipants.map(() => '(?, ?, ?, NOW(), 0, 0)').join(', ');
    const participantParams = uniqParticipants.flatMap(uid => [uuidv4(), chatId, uid]);
    await run(
      `INSERT INTO chat_participants (id, chatId, userId, joinedAt, isMuted, isAdmin)
       VALUES ${participantValues}`,
      participantParams
    );

    const uniqAdmins = new Set([String(createdBy), ...admins.map(String)]);
    const adminIds = uniqParticipants.filter(uid => uniqAdmins.has(uid));
    if (adminIds.length > 0) {
      const placeholders = adminIds.map(() => '?').join(', ');
      await run(
        `UPDATE chat_participants SET isAdmin = 1 WHERE chatId = ? AND userId IN (${placeholders})`,
        [chatId, ...adminIds]
      );
    }

    await cache.invalidateAllChats(createdBy);
    return { id: chatId, name: name.trim(), type: 'group', avatar, background, createdBy };
  }

  static async addParticipants(chatId, userIds = []) {
    const clean = Array.from(new Set(userIds.map(String).filter(Boolean)));
    if (!clean.length) return [];

    await ensureCapacity(chatId, clean.length);

    const values = clean.map(() => '(?, ?, ?, NOW())').join(', ');
    const params = clean.flatMap(uid => [uuidv4(), chatId, uid]);
    await run(
      `INSERT IGNORE INTO chat_participants (id, chatId, userId, joinedAt) VALUES ${values}`,
      params
    );

    await cache.invalidateChat(chatId);
    return clean;
  }

  static async removeParticipant(chatId, targetUserId, requesterId) {
    const selfRemoval = String(targetUserId) === String(requesterId);
    if (!(await isParticipant(chatId, targetUserId))) return;

    if (!selfRemoval && !(await isAdmin(chatId, requesterId))) {
      const e = new Error('FORBIDDEN'); e.code = 'FORBIDDEN'; throw e;
    }

    if (await isAdmin(chatId, targetUserId)) {
      const admins = await all(`SELECT userId FROM chat_participants WHERE chatId = ? AND isAdmin = 1`, [chatId]);
      if (admins.length <= 1) {
        const e = new Error('LAST_ADMIN'); e.code = 'LAST_ADMIN'; throw e;
      }
    }

    await run(`DELETE FROM chat_participants WHERE chatId = ? AND userId = ?`, [chatId, targetUserId]);
    await cache.invalidateChat(chatId);
    await cache.invalidateAllChats(targetUserId);
  }

  static async leave(chatId, userId) {
    await this.removeParticipant(chatId, userId, userId);
  }

  static async setAdmin(chatId, requesterId, targetUserId, makeAdmin) {
    if (!(await isAdmin(chatId, requesterId))) {
      const e = new Error('FORBIDDEN'); e.code = 'FORBIDDEN'; throw e;
    }

    if (!makeAdmin) {
      const admins = await all(`SELECT 1 FROM chat_participants WHERE chatId = ? AND isAdmin = 1`, [chatId]);
      if (admins.length <= 1) {
        const e = new Error('LAST_ADMIN'); e.code = 'LAST_ADMIN'; throw e;
      }
    }

    await run(
      `UPDATE chat_participants SET isAdmin = ? WHERE chatId = ? AND userId = ?`,
      [makeAdmin ? 1 : 0, chatId, targetUserId]
    );

    await cache.invalidateChat(chatId);
  }

  static async rename(chatId, requesterId, newName) {
    if (!newName?.trim()) {
      const e = new Error('INVALID_INPUT'); e.code = 'INVALID_INPUT'; throw e;
    }
    if (!(await isAdmin(chatId, requesterId))) {
      const e = new Error('FORBIDDEN'); e.code = 'FORBIDDEN'; throw e;
    }
    await run(`UPDATE chats SET name = ? WHERE id = ?`, [newName.trim(), chatId]);
    await cache.invalidateChat(chatId);
  }

  static async updateGroupAvatar(chatId, requesterId, avatar) {
    if (!(await isAdmin(chatId, requesterId))) {
      const e = new Error('FORBIDDEN'); e.code = 'FORBIDDEN'; throw e;
    }
    await run(`UPDATE chats SET avatar = ? WHERE id = ?`, [avatar, chatId]);
    await cache.invalidateChat(chatId);
  }

  // --- NEW: UPDATE BACKGROUND ---
  static async updateBackground(chatId, requesterId, background) {
    const chat = await this.getById(chatId);
    if (!chat) throw new Error('CHAT_NOT_FOUND');

    // Only admins can update background for group
    if (chat.type === 'group' && !(await isAdmin(chatId, requesterId))) {
      const e = new Error('FORBIDDEN'); e.code = 'FORBIDDEN'; throw e;
    }

    await run(`UPDATE chats SET background = ? WHERE id = ?`, [background, chatId]);
    await cache.invalidateChat(chatId);
    return background;
  }

  // --- REQUÊTES GÉNÉRALES ---
  static async getById(id) {
    if (!id) return null;
    const [row] = await all(`SELECT * FROM chats WHERE id = ? LIMIT 1`, [id]);
    return row || null;
  }

  static async getByUserId(userId) {
    if (!userId) return [];

    const cached = await cache.getChats(userId);
    if (cached) return cached;

    const rows = await all(
      `SELECT DISTINCT
         c.id, c.type, c.name, c.avatar AS chatAvatar, c.background,
         c.user1Id, c.user2Id, c.createdBy, c.createdAt,
         cp.isMuted, cp.muteUntil, cp.isAdmin,
         m.text AS lastMessage, m.senderId AS lastMessageSenderId,
         m.receiverId AS lastMessageReceiverId, m.timestamp AS lastMessageTime,
         mr.readAt AS lastMessageReadAt,
         COALESCE(unread.count, 0) AS unreadCount
       FROM chats c
       JOIN chat_participants cp ON c.id = cp.chatId AND cp.userId = ?
       LEFT JOIN messages m ON m.chatId = c.id
         AND m.timestamp = (SELECT MAX(timestamp) FROM messages WHERE chatId = c.id)
       LEFT JOIN message_reads mr ON mr.messageId = m.id AND mr.userId = ?
       LEFT JOIN (
         SELECT m2.chatId, COUNT(*) AS count
         FROM messages m2
         LEFT JOIN message_reads mr2 ON m2.id = mr2.messageId AND mr2.userId = ?
         WHERE m2.receiverId = ? AND mr2.messageId IS NULL
         GROUP BY m2.chatId
       ) unread ON unread.chatId = c.id
       ORDER BY COALESCE(m.timestamp, c.createdAt) DESC`,
      [userId, userId, userId, userId]
    );

    const result = rows.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      chatAvatar: r.chatAvatar,
      background: r.background,
      user1Id: r.user1Id,
      user2Id: r.user2Id,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      isMuted: !!r.isMuted,
      muteUntil: r.muteUntil,
      isAdmin: !!r.isAdmin,
      lastMessage: r.lastMessage,
      lastMessageSenderId: r.lastMessageSenderId,
      lastMessageReceiverId: r.lastMessageReceiverId,
      lastMessageReadAt: r.lastMessageReadAt,
      lastMessageTime: r.lastMessageTime,
      unreadCount: Number(r.unreadCount),
    }));

    await cache.setChats(userId, result, 30);
    return result;
  }

  static async getParticipants(chatId) {
    if (!chatId) return [];
    const rows = await all(
      `SELECT
         u.id, u.name, u.email, u.phone, u.avatar, u.role, u.isSupport, u.isOnline, u.lastSeen,
         cp.joinedAt, cp.isMuted, cp.muteUntil, cp.isAdmin
       FROM users u
       JOIN chat_participants cp ON u.id = cp.userId
       WHERE cp.chatId = ?
       ORDER BY cp.joinedAt ASC`,
      [chatId]
    );
    return rows;
  }

  static async getParticipantSettings(chatId, userId) {
    const [row] = await all(`SELECT * FROM chat_participants WHERE chatId = ? AND userId = ? LIMIT 1`, [chatId, userId]);
    return row || null;
  }

  static async updateParticipantSettings(chatId, userId, updates) {
    const fields = Object.keys(updates).filter(k => updates[k] !== undefined);
    if (!fields.length) return this.getParticipantSettings(chatId, userId);

    const sets = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    await run(`UPDATE chat_participants SET ${sets} WHERE chatId = ? AND userId = ?`, [...values, chatId, userId]);

    await cache.invalidateChat(chatId);
    return this.getParticipantSettings(chatId, userId);
  }

  static async setMute(chatId, userId, { muteUntil = null, isMuted = true } = {}) {
    const settings = await this.updateParticipantSettings(chatId, userId, {
      isMuted: isMuted ? 1 : 0,
      muteUntil
    });
    await cache.invalidateAllChats(userId);
    return settings;
  }

  // --- EXPORTS UTILS ---
  static isParticipant = isParticipant;
  static isAdmin = isAdmin;
  static getParticipantCount = getParticipantCount;
}

module.exports = Chat;
