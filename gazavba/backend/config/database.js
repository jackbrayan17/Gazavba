/* eslint-env node */
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

let pool;
let db;
let mode = 'sqlite';

const run = async (sql, params = []) => {
  try {
    if (mode === 'mysql') {
      if (!pool) throw new Error('Database not initialized');
      const [result] = await pool.query(sql, params);
      return result;
    }

    if (!db) throw new Error('Database not initialized');
    return await new Promise((resolve, reject) => {
      db.run(sql, params, function runCallback(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  } catch (err) {
    console.error(`[DB] Error running SQL: ${sql}`, err);
    throw err;
  }
};

const all = async (sql, params = []) => {
  if (mode === 'mysql') {
    const rows = await run(sql, params);
    return rows;
  }
  if (!db) throw new Error('Database not initialized');
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const initDatabase = async () => {
  try {
    if (process.env.DB_CLIENT === 'mysql') {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        connectionLimit: 10,
      });

      await pool.query('SELECT 1');
      mode = 'mysql';
      console.log('✅ Connected to MySQL Database');
    } else {
      const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'database.sqlite');
      db = new sqlite3.Database(sqlitePath);
      mode = 'sqlite';
      console.log(`✅ Connected to SQLite database at ${sqlitePath}`);
    }

    await createTables();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Crée les tables nécessaires si elles n'existent pas
 */
const createTables = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50) UNIQUE,
      avatar TEXT,
      password TEXT,
      role VARCHAR(50) DEFAULT 'user',
      isSuperAdmin BOOLEAN DEFAULT 0,
      isOnline BOOLEAN DEFAULT 0,
      lastSeen DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chats (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      type VARCHAR(50) DEFAULT 'direct',
      createdBy VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      id VARCHAR(255) PRIMARY KEY,
      chatId VARCHAR(255),
      userId VARCHAR(255),
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      isMuted TINYINT DEFAULT 0,
      muteUntil DATETIME,
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(255) PRIMARY KEY,
      chatId VARCHAR(255),
      senderId VARCHAR(255),
      text TEXT,
      messageType VARCHAR(50) DEFAULT 'text',
      mediaUrl TEXT,
      mediaName TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      isRead BOOLEAN DEFAULT 0,
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (senderId) REFERENCES users(id)
    )
  `);

  await run(`ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS isMuted TINYINT DEFAULT 0`);
  await run(`ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS muteUntil DATETIME`);
  await run(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS mediaName TEXT`);

  await run(`
    CREATE TABLE IF NOT EXISTS statuses (
      id VARCHAR(255) PRIMARY KEY,
      userId VARCHAR(255),
      type VARCHAR(50) DEFAULT 'text',
      content TEXT,
      mediaUrl TEXT,
      expiresAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS status_views (
      id VARCHAR(255) PRIMARY KEY,
      statusId VARCHAR(255),
      viewerId VARCHAR(255),
      viewedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (statusId) REFERENCES statuses(id),
      FOREIGN KEY (viewerId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS message_reads (
      id VARCHAR(255) PRIMARY KEY,
      messageId VARCHAR(255),
      userId VARCHAR(255),
      readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (messageId) REFERENCES messages(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  console.log('✅ Database tables checked and initialized');
};

module.exports = { initDatabase, run, all, db, mode: () => mode };
