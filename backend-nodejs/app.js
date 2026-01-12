/* eslint-env node */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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
const activeSockets = new Map(); // userId → Set<socket.id>
const PRESENCE_TTL = 30;

const broadcastOnlineUsers = async () => {
  const online = Array.from(activeSockets.keys());
  await cache.set('online_users', online, PRESENCE_TTL);
  io.emit('users_online', { userIds: online });
};

const setPresence = async (userId, online) => {
  if (!userId) return;
  try {
    await User.setOnlineStatus(userId, online);
    const user = await User.getById(userId);
    io.emit('user_presence', {
      userId,
      isOnline: online,
      lastSeen: user?.lastSeen,
    });
  } catch (e) {
    console.error('Presence error:', e);
  }
};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join', async (payload) => {
    const userId = String(payload?.userId || payload?.id || '');
    if (!userId) return socket.emit('error', { message: 'Invalid user' });

    socket.data.userId = userId;
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
      await setPresence(userId, true);
      await broadcastOnlineUsers();
    }

    socket.emit('joined', {
      userId,
      supportChatId: SUPPORT_CHAT_UUID,
      onlineCount: activeSockets.size,
    });
  });

  /* ==================== MESSAGES ==================== */
  socket.on('send_message', async (data) => {
    const { chatId, text, messageType = 'text', mediaUrl, mediaName, clientId } = data;
    const senderId = data.senderId || socket.data.userId;
    if (!chatId || !senderId) return;

    const finalChatId = chatId === SUPPORT_TOKEN ? SUPPORT_CHAT_UUID : chatId;

    try {
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
    } catch (e) {
      socket.emit('message_error', { error: e.message });
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
            await setPresence(userId, false);
            await broadcastOnlineUsers();
          }
        }, PRESENCE_TTL * 1000);
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
      await setPresence(userId, false);
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
