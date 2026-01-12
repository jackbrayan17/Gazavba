CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT,
  avatar TEXT,
  about TEXT,
  isOnline INTEGER DEFAULT 0,
  lastSeen TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'direct', -- 'direct', 'group'
  title TEXT,
  avatar TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chatId TEXT,
  userId TEXT,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joinedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chatId, userId),
  FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'audio', 'file'
  content TEXT,
  mediaUrl TEXT,
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
  readAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS statuses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT DEFAULT 'text', -- 'text', 'image', 'video'
  content TEXT,
  mediaUrl TEXT,
  privacy TEXT DEFAULT 'contacts', -- 'contacts', 'everyone', 'private'
  expiresAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  viewCount INTEGER DEFAULT 0,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS status_views (
  statusId TEXT,
  viewerId TEXT,
  viewedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (statusId, viewerId),
  FOREIGN KEY (statusId) REFERENCES statuses(id) ON DELETE CASCADE,
  FOREIGN KEY (viewerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  userId TEXT,
  contactId TEXT,
  name TEXT, -- Local name for the contact
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, contactId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contactId) REFERENCES users(id) ON DELETE CASCADE
);
