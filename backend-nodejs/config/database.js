/* eslint-env node */
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

/* ==================== UTILS ==================== */
const getPass = () => process.env.DB_PASS ?? process.env.DB_PASSWORD ?? '';
const toBool = (v) => (v === true || v === 'true' || v === '1');

/* ==================== POOL ENSURE ==================== */
async function ensurePool() {
  if (!pool) await initDatabase();
  return pool;
}

/* ==================== QUERY HELPERS ==================== */
async function query(sql, params = []) {
  const p = await ensurePool();
  try {
    const [rows] = await p.query(sql, params);
    return rows;
  } catch (err) {
    console.error(`[DB] SQL error (query):\n${sql}\nparams:`, params, '\nerr:', err.message);
    throw err;
  }
}
async function all(sql, params = []) {
  return query(sql, params);
}
async function run(sql, params = []) {
  const p = await ensurePool();
  try {
    const [result] = await p.execute(sql, params);
    return result;
  } catch (err) {
    console.error(`[DB] SQL error (run):\n${sql}\nparams:`, params, '\nerr:', err.message);
    throw err;
  }
}
async function runIgnore(sql, params = []) {
  try {
    return await run(sql, params);
  } catch {
    return null;
  }
}
async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows?.[0] ?? null;
}

/* ==================== SCHEMA HELPERS ==================== */
async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.c || 0) > 0;
}
async function indexExists(table, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number(rows?.[0]?.c || 0) > 0;
}
async function tableExists(table) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows?.[0]?.c || 0) > 0;
}
async function addColumnIfMissing(table, specSql) {
  const match = specSql.match(/ADD\s+COLUMN\s+`?([a-zA-Z0-9_]+)`?/i);
  const col = match?.[1];
  if (!col || (await columnExists(table, col))) return;
  await run(`ALTER TABLE \`${table}\` ${specSql}`);
  console.log(`Added column: ${table}.${col}`);
}
async function addIndexIfMissing(table, indexName, specSql) {
  if (await indexExists(table, indexName)) return;
  await runIgnore(specSql);
  console.log(`Added index: ${indexName} on ${table}`);
}
async function createTableIfMissing(tableName, createSql) {
  if (await tableExists(tableName)) return;
  await run(createSql);
  console.log(`Created table: ${tableName}`);
}

/* ==================== DATABASE INIT ==================== */
async function initDatabase() {
  if (pool) return pool;

  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'appuser',
    password: getPass(),
    database: process.env.DB_NAME || 'appdb',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL || 10),
    queueLimit: 0,
    dateStrings: true,
    multipleStatements: false,
    supportBigNumbers: true,
    charset: 'utf8mb4',
    timezone: '+01:00', // WAT - Cameroon
    connectTimeout: 10000,
  };

  console.log('Connecting to MySQL...');
  pool = mysql.createPool(config);
  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
    console.log('Connected to MySQL');
    await connection.query(`ALTER DATABASE \`${config.database}\` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci`);
  } catch (e) {
    console.error('MySQL connection failed:', e.message);
    throw e;
  } finally {
    connection.release();
  }

  await createTables();
  await migrateSchema();
  await ensureSupportChatRow();

  return pool;
}

/* ==================== TABLE CREATION ==================== */
async function createTables() {
  const CHARSET = 'utf8mb4';
  const COLLATION = 'utf8mb4_unicode_ci';

  /* users */
  await createTableIfMissing('users', `
    CREATE TABLE users (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50) UNIQUE,
      avatar TEXT,
      bio TEXT NULL,
      password VARCHAR(255),
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      isSuperAdmin TINYINT(1) NOT NULL DEFAULT 0,
      isOnline TINYINT(1) NOT NULL DEFAULT 0,
      lastSeen DATETIME NULL,
      isVerified TINYINT(1) NOT NULL DEFAULT 0,
      isSupport TINYINT(1) NOT NULL DEFAULT 0,
      backgroundGlobal TEXT NULL,
      statusPrivacy ENUM('private', 'general') NOT NULL DEFAULT 'private',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_email (email),
      INDEX idx_users_phone (phone),
      INDEX idx_users_online (isOnline),
      INDEX idx_users_support (isSupport)
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* contacts */
  await createTableIfMissing('contacts', `
    CREATE TABLE contacts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      ownerId CHAR(36) NOT NULL,
      name VARCHAR(255),
      phone VARCHAR(50) NOT NULL,
      avatar TEXT,
      hasAccountUserId CHAR(36) NULL,
      isMuted TINYINT(1) NOT NULL DEFAULT 0,
      isBlocked TINYINT(1) NOT NULL DEFAULT 0,
      lastInteraction DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_contacts_owner_phone (ownerId, phone),
      INDEX idx_contacts_owner (ownerId),
      INDEX idx_contacts_account (hasAccountUserId),
      CONSTRAINT fk_contacts_owner FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_contacts_account FOREIGN KEY (hasAccountUserId) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* chats */
  await createTableIfMissing('chats', `
    CREATE TABLE chats (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(255),
      type ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
      avatar TEXT NULL,
      background TEXT NULL,
      user1Id CHAR(36) NULL,
      user2Id CHAR(36) NULL,
      createdBy CHAR(36),
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_chats_type (type),
      INDEX idx_chats_user1 (user1Id),
      INDEX idx_chats_user2 (user2Id),
      INDEX idx_chats_createdBy (createdBy),
      CONSTRAINT fk_chats_user1 FOREIGN KEY (user1Id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_chats_user2 FOREIGN KEY (user2Id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_chats_createdBy FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* chat_participants */
  await createTableIfMissing('chat_participants', `
    CREATE TABLE chat_participants (
      id CHAR(36) NOT NULL PRIMARY KEY,
      chatId CHAR(36) NOT NULL,
      userId CHAR(36) NOT NULL,
      joinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      isMuted TINYINT(1) NOT NULL DEFAULT 0,
      muteUntil DATETIME NULL,
      isAdmin TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_chat_user (chatId, userId),
      INDEX idx_cp_chat (chatId),
      INDEX idx_cp_user (userId),
      CONSTRAINT fk_cp_chat FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
      CONSTRAINT fk_cp_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* messages */
  await createTableIfMissing('messages', `
    CREATE TABLE messages (
      id CHAR(36) NOT NULL PRIMARY KEY,
      chatId CHAR(36) NOT NULL,
      senderId CHAR(36) NOT NULL,
      receiverId CHAR(36) NULL,
      text TEXT,
      messageType VARCHAR(50) DEFAULT 'text',
      mediaUrl TEXT,
      mediaName TEXT,
      clientId CHAR(36) NULL,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_messages_chatId (chatId),
      INDEX idx_messages_senderId (senderId),
      INDEX idx_messages_receiverId (receiverId),
      INDEX idx_messages_timestamp (timestamp),
      INDEX idx_messages_clientId (clientId),
      CONSTRAINT fk_messages_chat FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_sender FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_receiver FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* message_reads */
  await createTableIfMissing('message_reads', `
    CREATE TABLE message_reads (
      messageId CHAR(36) NOT NULL,
      userId CHAR(36) NOT NULL,
      readAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (messageId, userId),
      INDEX idx_mr_user (userId),
      CONSTRAINT fk_mr_msg FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
      CONSTRAINT fk_mr_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* statuses */
  await createTableIfMissing('statuses', `
    CREATE TABLE statuses (
      id CHAR(36) NOT NULL PRIMARY KEY,
      userId CHAR(36) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'text',
      content TEXT,
      mediaUrl TEXT,
      expiresAt DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_status_user (userId),
      INDEX idx_status_expires (expiresAt),
      CONSTRAINT fk_status_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* status_views */
  await createTableIfMissing('status_views', `
    CREATE TABLE status_views (
      id CHAR(36) NOT NULL PRIMARY KEY,
      statusId CHAR(36) NOT NULL,
      viewerId CHAR(36) NOT NULL,
      viewedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_status_viewer (statusId, viewerId),
      INDEX idx_sv_status (statusId),
      INDEX idx_sv_viewer (viewerId),
      CONSTRAINT fk_sv_status FOREIGN KEY (statusId) REFERENCES statuses(id) ON DELETE CASCADE,
      CONSTRAINT fk_sv_viewer FOREIGN KEY (viewerId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* contact_links */
  await createTableIfMissing('contact_links', `
    CREATE TABLE contact_links (
      id CHAR(36) NOT NULL PRIMARY KEY,
      userAId CHAR(36) NOT NULL,
      userBId CHAR(36) NOT NULL,
      connectedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_contact_pair (userAId, userBId),
      INDEX idx_cl_userA (userAId),
      INDEX idx_cl_userB (userBId),
      CONSTRAINT fk_cl_userA FOREIGN KEY (userAId) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_cl_userB FOREIGN KEY (userBId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  /* user_chat_settings */
  await createTableIfMissing('user_chat_settings', `
    CREATE TABLE user_chat_settings (
      id CHAR(36) NOT NULL PRIMARY KEY,
      userId CHAR(36) NOT NULL,
      chatId CHAR(36) NOT NULL,
      background TEXT NULL,
      UNIQUE KEY uniq_user_chat (userId, chatId),
      INDEX idx_ucs_user (userId),
      INDEX idx_ucs_chat (chatId),
      CONSTRAINT fk_ucs_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ucs_chat FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${CHARSET} COLLATE=${COLLATION}
  `);

  console.log('Database tables initialized with utf8mb4_unicode_ci');
}

/* ==================== MIGRATION ==================== */
async function migrateSchema() {
  // bio
  await addColumnIfMissing('users', 'ADD COLUMN bio TEXT NULL AFTER avatar');

  // backgroundGlobal
  await addColumnIfMissing('users', 'ADD COLUMN backgroundGlobal TEXT NULL AFTER isSupport');

  // statusPrivacy
  await addColumnIfMissing('users', `ADD COLUMN statusPrivacy ENUM('private','general') NOT NULL DEFAULT 'private' AFTER backgroundGlobal`);

  // chats.background
  await addColumnIfMissing('chats', 'ADD COLUMN background TEXT NULL AFTER avatar');

  // chats.user1Id / user2Id
  await addColumnIfMissing('chats', 'ADD COLUMN user1Id CHAR(36) NULL AFTER avatar');
  await addColumnIfMissing('chats', 'ADD COLUMN user2Id CHAR(36) NULL AFTER user1Id');

  // Indexes
  await addIndexIfMissing('chats', 'idx_chats_user1', 'ALTER TABLE chats ADD INDEX idx_chats_user1 (user1Id)');
  await addIndexIfMissing('chats', 'idx_chats_user2', 'ALTER TABLE chats ADD INDEX idx_chats_user2 (user2Id)');

  // messages fields
  await addColumnIfMissing('messages', 'ADD COLUMN receiverId CHAR(36) NULL AFTER senderId');
  await addColumnIfMissing('messages', 'ADD COLUMN clientId CHAR(36) NULL AFTER mediaName');
  await addIndexIfMissing('messages', 'idx_messages_receiverId', 'ALTER TABLE messages ADD INDEX idx_messages_receiverId (receiverId)');
  await addIndexIfMissing('messages', 'idx_messages_clientId', 'ALTER TABLE messages ADD INDEX idx_messages_clientId (clientId)');

  // message_reads PK
  const pkExists = await query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'message_reads'
       AND CONSTRAINT_TYPE = 'PRIMARY KEY'`
  );
  if (Number(pkExists[0].c) === 0) {
    await run(`ALTER TABLE message_reads ADD PRIMARY KEY (messageId, userId)`);
  }

  console.log('Schema migration complete');
}

/* ==================== SUPPORT CHAT ==================== */
async function ensureSupportChatRow() {
  const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID || 'gazavba_support_chat';
  const SUPPORT_CHAT_NAME = process.env.SUPPORT_CHAT_NAME || 'Gazavba Support';

  await run(
    `INSERT IGNORE INTO chats (id, name, type, background) VALUES (?, ?, 'group', ?)`,
    [SUPPORT_CHAT_ID, SUPPORT_CHAT_NAME, null]
  );

  await run(
    `INSERT IGNORE INTO chat_participants (id, chatId, userId, isAdmin)
     SELECT UUID(), ?, id, 1 FROM users WHERE isSupport = 1`,
    [SUPPORT_CHAT_ID]
  );

  console.log(`Support chat ensured: ${SUPPORT_CHAT_ID}`);
}

/* ==================== CLOSE ==================== */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MySQL pool closed');
  }
}

/* ==================== EXPORT ==================== */
module.exports = {
  initDatabase,
  query,
  all,
  get,
  run,
  runIgnore,
  closeDatabase,
  toBool,
  ensureSupportChatRow,
};
