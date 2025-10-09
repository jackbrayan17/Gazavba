const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT UNIQUE,
          avatar TEXT,
          isOnline BOOLEAN DEFAULT 0,
          lastSeen DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chats table
      db.run(`
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

      // Chat participants
      db.run(`
        CREATE TABLE IF NOT EXISTS chat_participants (
          id TEXT PRIMARY KEY,
          chatId TEXT,
          userId TEXT,
          joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chatId) REFERENCES chats(id),
          FOREIGN KEY (userId) REFERENCES users(id)
        )
      `);

      // Messages table
      db.run(`
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

      // Statuses table
      db.run(`
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

      // Status views
      db.run(`
        CREATE TABLE IF NOT EXISTS status_views (
          id TEXT PRIMARY KEY,
          statusId TEXT,
          viewerId TEXT,
          viewedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (statusId) REFERENCES statuses(id),
          FOREIGN KEY (viewerId) REFERENCES users(id)
        )
      `);

      // Message reads
      db.run(`
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
      resolve();
    });
  });
};

module.exports = { db, initDatabase };
