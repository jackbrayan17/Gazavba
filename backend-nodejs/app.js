/* eslint-env node */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
require('dotenv').config();

// === INIT DB & SEED ===
const { initDatabase, all } = require('./config/database');
const { seedDatabase } = require('./scripts/init-db');
const { cache } = require('./config/cache');
const Message = require('./models/Message');
const User = require('./models/User');
const Chat = require('./models/Chat');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);
const IO_CORS_ORIGIN = process.env.IO_CORS_ORIGIN || '';
const SUPPORT_TOKEN = process.env.SUPPORT_CHAT_TOKEN || 'gazavba_support_chat';
let SUPPORT_CHAT_UUID = null;
let { JWT_SECRET } = (() => {
  try { return require('./config/auth'); }
  catch { return {}; }
})();
JWT_SECRET = JWT_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required (set env JWT_SECRET)');
}

/* ==================== CONFIG ==================== */
const UPLOAD_PATH = path.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads');
const BG_PATH = path.join(UPLOAD_PATH, 'backgrounds');
const PUBLIC_PATH = path.join(__dirname, 'public');

// Ensure upload directories
[UPLOAD_PATH, BG_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const isLocalOrigin = (origin) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (IO_CORS_ORIGIN === '*' || CORS_ORIGINS.includes('*')) return true;
  if (IO_CORS_ORIGIN && origin === IO_CORS_ORIGIN) return true;
  if (CORS_ORIGINS.includes(origin)) return true;
  if (isLocalOrigin(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: true,
    allowedHeaders: corsOptions.allowedHeaders,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 25 * 1024 * 1024,
});

/* ==================== REDIS ADAPTER + PRESENCE ==================== */
const redisUrl = process.env.UPSTASH_REDIS_URL
  || process.env.REDIS_URL
  || (process.env.REDIS_HOST
    ? `redis://:${process.env.REDIS_PASS || ''}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
    : null);

let redisPub = null;
let redisSub = null;
if (redisUrl) {
  redisPub = new Redis(redisUrl, {
    tls: process.env.UPSTASH_REDIS_URL ? { rejectUnauthorized: false } : undefined,
  });
  redisSub = redisPub.duplicate();
  io.adapter(createAdapter(redisPub, redisSub));
  console.log('[SocketIO] Redis adapter initialised for app.js');
} else {
  console.warn('[SocketIO] WARNING: no Redis URL provided, WS will not scale horizontally.');
}

const PRESENCE_TTL_SECONDS = Number(process.env.PRESENCE_TTL_SECONDS || 45);
const PRESENCE_FLUSH_INTERVAL_MS = Number(process.env.PRESENCE_FLUSH_INTERVAL_MS || 60000);
const presenceKey = (userId) => `presence:${userId}`;
const lastPresenceWrite = new Map();

const markPresence = async (userId, isOnline = true) => {
  if (redisPub && userId) {
    if (isOnline) {
      await redisPub.set(presenceKey(userId), '1', 'EX', PRESENCE_TTL_SECONDS);
    } else {
      await redisPub.del(presenceKey(userId));
    }
  }
};

const flushPresenceToDb = async (userId, isOnline) => {
  const now = Date.now();
  const last = lastPresenceWrite.get(userId) || 0;
  if (isOnline && now - last < PRESENCE_FLUSH_INTERVAL_MS) return;
  await User.setOnlineStatus(userId, isOnline);
  lastPresenceWrite.set(userId, now);
};

const broadcastPresence = async (userId, isOnline) => {
  await markPresence(userId, isOnline);
  await flushPresenceToDb(userId, isOnline);
  const user = await User.getById(userId);
  io.emit('user_presence', {
    userId,
    isOnline,
    lastSeen: user?.lastSeen,
  });
};

const isUserOnline = async (userId) => {
  if (redisPub) {
    const val = await redisPub.get(presenceKey(userId));
    return val !== null;
  }
  return false;
};

/* ==================== MIDDLEWARE ==================== */
app.use(cors(corsOptions));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_PATH));
app.use('/uploads', express.static(UPLOAD_PATH)); // Serves avatars + backgrounds

// Helpful CORS preflight for all routes
app.options('*', cors(corsOptions));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_PATH, 'index.html'));
});

/* ==================== ROUTES ==================== */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/statuses', require('./routes/statuses'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/support', require('./routes/support'));
app.use('/api/wallet', require('./routes/wallet'));

app.set('io', io);

/* ==================== SUPPORT CHAT ==================== */
async function ensureSupportChat() {
  const marker = process.env.SUPPORT_CHAT_NAME || 'Gazavba Support';
  const [row] = await all(`SELECT id FROM chats WHERE name = ? LIMIT 1`, [marker]);
  if (row) {
    SUPPORT_CHAT_UUID = row.id;
    console.log('Support chat found:', SUPPORT_CHAT_UUID);
    return;
  }
  const admin = await User.getByRole?.('admin');
  if (!admin) throw new Error('No admin user for support chat');
  const chat = await Chat.createGroup({
    name: marker,
    createdBy: admin.id,
    participants: [],
    admins: [admin.id],
  });
  SUPPORT_CHAT_UUID = chat.id;
  console.log('Support chat created:', SUPPORT_CHAT_UUID);
}

/* ==================== PRESENCE & SOCKET.IO ==================== */
const activeSockets = new Map(); // userId -> Set<socket.id>
const WS_RATE_WINDOW_MS = Number(process.env.SOCKET_RATE_LIMIT_WINDOW_MS || 10000);
const WS_RATE_MAX = Number(process.env.SOCKET_RATE_LIMIT_MAX || 60);
const wsRateCounters = new Map();
const isRateLimited = (userId) => {
  if (!userId) return true;
  const now = Date.now();
  const entry = wsRateCounters.get(userId) || { count: 0, start: now };
  if (now - entry.start > WS_RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  wsRateCounters.set(userId, entry);
  return entry.count > WS_RATE_MAX;
};

io.use(async (socket, next) => {
  try {
    const raw =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;
    const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;
    if (!token) return next(new Error('UNAUTHORIZED'));

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) return next(new Error('UNAUTHORIZED'));

    const user = await User.getById(userId);
    if (!user) return next(new Error('USER_NOT_FOUND'));

    socket.data.userId = userId;
    socket.data.user = user;
    await broadcastPresence(userId, true);
    return next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    return next(new Error('UNAUTHORIZED'));
  }
});

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join', async () => {
    const userId = socket.data.userId;
    if (!userId) return socket.emit('error', { message: 'Invalid user' });
    socket.join(`user_${userId}`);

    try {
      const chats = await Chat.getByUserId(userId);
      chats.forEach(c => socket.join(`chat_${c.id}`));
      if (SUPPORT_CHAT_UUID) socket.join(`chat_${SUPPORT_CHAT_UUID}`);
    } catch (e) {
      console.error('Join chats error:', e);
    }

    const set = activeSockets.get(userId) || new Set();
    const wasOffline = set.size === 0;
    set.add(socket.id);
    activeSockets.set(userId, set);

    if (wasOffline) {
      await broadcastPresence(userId, true);
    }

    socket.emit('joined', {
      userId,
      supportChatId: SUPPORT_CHAT_UUID,
      onlineCount: activeSockets.size,
    });
  });

  /* ==================== MESSAGES ==================== */
  socket.on('send_message', async (data, ack) => {
    const { chatId, text, messageType = 'text', mediaUrl, mediaName, clientId } = data || {};
    const senderId = socket.data.userId;
    if (!chatId || !senderId) {
      const err = { error: 'Missing chatId or senderId' };
      ack?.(err); socket.emit('message_error', err); return;
    }
    if (isRateLimited(senderId)) {
      const err = { error: 'RATE_LIMITED' };
      ack?.(err); socket.emit('message_error', err); return;
    }

    const finalChatId = chatId === SUPPORT_TOKEN ? SUPPORT_CHAT_UUID : chatId;

    try {
      const chat = await Chat.getById(finalChatId);
      if (!chat) throw new Error('CHAT_NOT_FOUND');
      if (chat.type === 'direct') {
        if (![chat.user1Id, chat.user2Id].includes(senderId)) throw new Error('NOT_IN_CHAT');
      } else if (!(await Chat.isParticipant(finalChatId, senderId))) {
        throw new Error('NOT_IN_CHAT');
      }

      const msg = await Message.create({
        chatId: finalChatId,
        senderId,
        text,
        messageType,
        mediaUrl,
        mediaName,
        clientId,
      });

      const sender = await User.getById(senderId);
      const enriched = {
        ...msg,
        senderName: sender?.name || 'Unknown',
        senderAvatar: sender?.avatar,
        status: 'sent',
      };

      await cache.invalidate(`messages:${finalChatId}:*`);
      await cache.invalidateAllChats(senderId);

      socket.emit('message_sent', enriched);
      socket.to(`chat_${finalChatId}`).emit('message_new', enriched);
      ack?.({ ok: true, message: enriched });

      // Notify delivery if receiver online
      if (msg.receiverId) {
        const receiverId = String(msg.receiverId);
        if (await isUserOnline(receiverId)) {
          io.to(`user_${senderId}`).emit('message_delivered', {
            messageId: msg.id,
            chatId: finalChatId,
            receiverId,
            deliveredAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      const err = { error: e.message };
      ack?.(err);
      socket.emit('message_error', err);
    }
  });

  socket.on('typing', (data) => {
    const { chatId, isTyping } = data;
    const userId = socket.data.userId;
    if (!chatId || !userId) return;
    const room = `chat_${chatId === SUPPORT_TOKEN ? SUPPORT_CHAT_UUID : chatId}`;
    socket.to(room).emit('typing', { chatId, userId, isTyping });
  });

  socket.on('messages_read', async ({ chatId, messageIds }) => {
    if (!chatId || !messageIds?.length) return;
    const userId = socket.data.userId;
    const finalChatId = chatId === SUPPORT_TOKEN ? SUPPORT_CHAT_UUID : chatId;

    try {
      await Message.markAsReadBatch(messageIds, userId);
      await cache.invalidateAllChats(userId);
      socket.to(`chat_${finalChatId}`).emit('message_read', { messageIds, readerId: userId });
    } catch (e) {
      console.error('Read receipt error:', e);
    }
  });

  /* ==================== BACKGROUND UPDATE ==================== */
  socket.on('set_chat_background', async ({ chatId, background }) => {
    const userId = socket.data.userId;
    if (!userId || !chatId) return;

    const finalChatId = chatId === SUPPORT_TOKEN ? SUPPORT_CHAT_UUID : chatId;

    try {
      const chat = await Chat.getById(finalChatId);
      if (!chat) throw new Error('CHAT_NOT_FOUND');
      if (!(await Chat.isParticipant(finalChatId, userId))) throw new Error('FORBIDDEN');

      const UserChatSettings = require('./models/UserChatSettings');
      await UserChatSettings.setBackground(userId, finalChatId, background);

      await cache.invalidateChat(finalChatId);
      await cache.invalidateAllChats(userId);

      io.to(`chat_${finalChatId}`).emit('user_chat_background_updated', {
        chatId: finalChatId,
        userId,
        background,
      });

      socket.emit('background_updated', { chatId: finalChatId, background });
    } catch (e) {
      socket.emit('background_error', { error: e.message });
    }
  });

  /* ==================== STATUS PRIVACY UPDATE ==================== */
  socket.on('set_status_privacy', async ({ statusPrivacy }) => {
    const userId = socket.data.userId;
    if (!userId) return;

    if (!['private', 'general'].includes(statusPrivacy)) {
      return socket.emit('error', { message: 'Invalid statusPrivacy' });
    }

    try {
      await User.update(userId, { statusPrivacy });

      io.emit('user_updated', { userId, statusPrivacy });

      socket.emit('status_privacy_updated', { statusPrivacy });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  /* ==================== DISCONNECT ==================== */
  socket.on('disconnect', async () => {
    const userId = socket.data.userId;
    if (!userId) return;

    const set = activeSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        activeSockets.delete(userId);
        setTimeout(async () => {
          if (!activeSockets.has(userId)) {
            await broadcastPresence(userId, false);
          }
        }, PRESENCE_TTL_SECONDS * 1000);
      }
    }
  });
});

/* ==================== HEALTH CHECK ==================== */
app.get('/health', async (req, res) => {
  const stats = await cache.getStats?.() || { hits: 0, misses: 0, keys: 0 };
  const bgCount = fs.readdirSync(BG_PATH).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f)).length;

  res.json({
    status: 'OK',
    timestamp: new Date().toLocaleString('fr-CM', { timeZone: 'Africa/Douala' }),
    timezone: 'WAT (West Africa Time)',
    country: 'CM',
    uptime: process.uptime(),
    supportChat: SUPPORT_CHAT_UUID,
    onlineUsers: activeSockets.size,
    uploads: {
      path: UPLOAD_PATH,
      backgrounds: {
        path: BG_PATH,
        count: bgCount,
        url: '/uploads/backgrounds/',
      },
    },
    cache: {
      hits: stats.hits || 0,
      misses: stats.misses || 0,
      keys: stats.keys || 0,
      hitRate: stats.hits && stats.misses
        ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
        : 'N/A',
    },
    redis: {
      connected: cache.connected || false,
      url: process.env.UPSTASH_REDIS_URL ? 'configured' : 'not set',
    },
  });
});

/* ==================== GRACEFUL SHUTDOWN ==================== */
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('\nShutting down gracefully...');
  try {
    server.close(() => console.log('HTTP server closed.'));
    io.close(() => console.log('Socket.IO closed.'));
    for (const userId of activeSockets.keys()) {
      await broadcastPresence(userId, false);
    }
    if (cache.quit) await cache.quit();
    console.log('Shutdown complete.');
    process.exit(0);
  } catch (e) {
    console.error('Shutdown error:', e);
    process.exit(1);
  }
}

/* ==================== START SERVER ==================== */
(async () => {
  try {
    await initDatabase();
    await ensureSupportChat();

    if (process.env.SKIP_SEED !== '1') {
      await seedDatabase().catch(e => console.warn('Seeding failed:', e.message));
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\nSERVER READY → http://localhost:${PORT}`);
      console.log(`Socket.IO CORS: ${IO_CORS_ORIGIN || 'dynamic'}`);
      console.log(`Support Chat: ${SUPPORT_CHAT_UUID}`);
      console.log(`Uploads: ${UPLOAD_PATH}`);
      console.log(`Backgrounds: ${BG_PATH} (${fs.readdirSync(BG_PATH).length} files)`);
      console.log(`Redis Cache: ${process.env.UPSTASH_REDIS_URL ? 'ON (Upstash)' : 'OFF (in-memory)'}`);
      console.log(`Online Users: ${activeSockets.size}`);
      console.log(`Time: ${new Date().toLocaleString('fr-CM', { timeZone: 'Africa/Douala' })} (WAT)\n`);
    });
  } catch (e) {
    console.error('Startup failed:', e);
    process.exit(1);
  }
})();
