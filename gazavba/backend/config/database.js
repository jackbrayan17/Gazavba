/* eslint-env node */
const mysql = require('mysql2/promise');
require('dotenv').config();

// Crée une variable globale pour la pool MySQL
let pool;

/**
 * Fonction pour exécuter une requête SQL
 * @param {string} sql - La requête SQL
 * @param {Array} params - Les paramètres à injecter
 */
const run = async (sql, params = []) => {
  try {
    if (!pool) throw new Error("Database not initialized");
    const [result] = await pool.query(sql, params);
    return result;
  } catch (err) {
    console.error(`[DB] Error running SQL: ${sql}`, err);
    throw err;
  }
};

/**
 * Initialise la connexion à la base MySQL
 */
const initDatabase = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      connectionLimit: 10,
    });

    // Test de connexion
    await pool.query('SELECT 1');
    console.log('✅ Connected to MySQL Database');

    // Création des tables si elles n’existent pas
    await createTables();
  } catch (error) {
    console.error('❌ Failed to connect to MySQL database:', error);
    process.exit(1);
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
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      isRead BOOLEAN DEFAULT 0,
      FOREIGN KEY (chatId) REFERENCES chats(id),
      FOREIGN KEY (senderId) REFERENCES users(id)
    )
  `);

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

module.exports = { initDatabase, run };
