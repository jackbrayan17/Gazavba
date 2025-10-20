/* eslint-env node */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite'); // eslint-disable-line no-undef
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) {
        console.error(`[DB] Failed to run statement: ${sql}`, err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

const columnExists = (table, column) =>
  new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows.some((row) => row.name === column));
    });
  });

const ensureColumn = async (table, column, definition) => {
  const exists = await columnExists(table, column);
  if (!exists) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    console.log(`[DB] Added missing column ${column} on ${table}`);
  }
};

// Initialize database tables
const initDatabase = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      avatar TEXT,
      password TEXT,
      role TEXT DEFAULT 'user',
      isSuperAdmin BOOLEAN DEFAULT 0,
      isOnline BOOLEAN DEFAULT 0,
      lastSeen DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('users', 'password', 'password TEXT');
  await ensureColumn('users', 'role', "role TEXT DEFAULT 'user'");
  await ensureColumn('users', 'isSuperAdmin', 'isSuperAdmin BOOLEAN DEFAULT 0');

  await run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT DEFAULT 'direct',
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      userId TEXT,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      senderId TEXT,
      text TEXT,
      messageType TEXT DEFAULT 'text',
      mediaUrl TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      isRead BOOLEAN DEFAULT 0,
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (senderId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      userId TEXT,
      type TEXT DEFAULT 'text',
      content TEXT,
      mediaUrl TEXT,
      expiresAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS status_views (
      id TEXT PRIMARY KEY,
      statusId TEXT,
      viewerId TEXT,
      viewedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (statusId) REFERENCES statuses(id),
      FOREIGN KEY (viewerId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY,
      messageId TEXT,
      userId TEXT,
      readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (messageId) REFERENCES messages(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  console.log('Database tables initialized');
};

module.exports = { db, initDatabase };
