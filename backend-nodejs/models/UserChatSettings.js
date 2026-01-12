/* eslint-env node */
const { all, run } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class UserChatSettings {
  static async setBackground(userId, chatId, background) {
    if (!userId) throw new Error('Missing userId');

    // Check if exists
    const [existing] = await all(
      `SELECT id FROM user_chat_settings WHERE userId = ? AND chatId = ? LIMIT 1`,
      [userId, chatId]
    );

    if (existing) {
      await run(
        `UPDATE user_chat_settings SET background = ? WHERE id = ?`,
        [background, existing.id]
      );
      return { id: existing.id, userId, chatId, background };
    }

    const id = uuidv4();
    await run(
      `INSERT INTO user_chat_settings (id, userId, chatId, background)
       VALUES (?, ?, ?, ?)`,
      [id, userId, chatId, background]
    );
    return { id, userId, chatId, background };
  }

  static async getBackground(userId, chatId) {
    // First try chat-specific
    let [row] = await all(
      `SELECT background FROM user_chat_settings WHERE userId = ? AND chatId = ? LIMIT 1`,
      [userId, chatId]
    );
    if (row?.background) return row.background;

    // Then global/default
    [row] = await all(
      `SELECT background FROM user_chat_settings WHERE userId = ? AND chatId IS NULL LIMIT 1`,
      [userId]
    );
    return row?.background || null;
  }
}

module.exports = UserChatSettings;
