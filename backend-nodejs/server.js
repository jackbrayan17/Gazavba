/* eslint-env node */
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { initDatabase } = require('./config/database');
const Chat = require('./models/Chat');
const User = require('./models/User');
const Message = require('./models/Message');
let { JWT_SECRET } = (() => {
  try { return require('./config/auth'); }
  catch { return {}; }
})();
JWT_SECRET = JWT_SECRET || process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required (set env JWT_SECRET)');
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
});

const PORT = process.env.PORT || 3000;

/* =========================
   Redis adapter + presence
========================= */
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
  console.log('[SocketIO] Redis adapter initialised');
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

const WS_RATE_WINDOW_MS = Number(process.env.SOCKET_RATE_LIMIT_WINDOW_MS || 10_000);
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

/* =========================
   Uploads directory
========================= */
const resolveUploadDir = (value) => {
  if (!value) return path.resolve(process.cwd(), 'uploads');
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};
const uploadDir = resolveUploadDir(process.env.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const publicDir = path.resolve(__dirname, 'public');

/* =========================
   Middlewares
========================= */
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadDir));
app.set('io', io);

// Helpful CORS preflight for all routes
app.options('*', cors());

/* =========================
   Health checks
========================= */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

/* =========================
   Routers (mounted with & without /api)
========================= */
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const chatsRouter = require('./routes/chats');
const messagesRouter = require('./routes/messages');
const statusesRouter = require('./routes/statuses');
const contactsRouter = require('./routes/contacts');
const supportRouter = require('./routes/support');
const callsRouter = require('./routes/calls');
const pollsRouter = require('./routes/polls');
const walletRouter = require('./routes/wallet');

// Without /api (in case proxy strips /api)
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/chats', chatsRouter);
app.use('/messages', messagesRouter);
app.use('/statuses', statusesRouter);
app.use('/contacts', contactsRouter);
app.use('/support', supportRouter);
app.use('/calls', callsRouter);
app.use('/polls', pollsRouter);
app.use('/wallet', walletRouter);

// With /api (what your RN client uses)
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/statuses', statusesRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/support', supportRouter);
app.use('/api/calls', callsRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/wallet', walletRouter);

/* =========================
   Socket.IO
========================= */
const isUserOnline = async (userId) => {
  if (redisPub) {
    const val = await redisPub.get(presenceKey(userId));
    return val !== null;
  }
  return false;
};

const joinUserRooms = async (socket, userId) => {
  socket.join(`user_${userId}`);
  try {
    const chats = await Chat.getByUserId(userId);
    chats.forEach((chat) => socket.join(`chat_${chat.id}`));
  } catch (error) {
    console.error('Join chats error:', error);
  }
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
    await markPresence(userId, true);
    return next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    return next(new Error('UNAUTHORIZED'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their room
  socket.on('join', async () => {
    const userId = socket.data.userId;
    if (!userId) return socket.emit('error', { message: 'Invalid user' });
    await joinUserRooms(socket, userId);
    await broadcastPresence(userId, true);
    console.log(`User ${userId} joined their rooms`);
    socket.emit('joined', { userId });
  });

  socket.on('heartbeat', async () => {
    const userId = socket.data.userId;
    if (!userId) return;
    await broadcastPresence(userId, true);
  });

  // Handle new message
  socket.on('send_message', async (data, ack) => {
    try {
      const payload = data || {};
      const chatId = payload.chatId;
      const senderId = socket.data.userId;
      const text = payload.text;
      const messageType = payload.messageType || 'text';
      const mediaUrl = payload.mediaUrl || null;
      const mediaName = payload.mediaName || null;
      const clientId = payload.clientId || null;

      if (!chatId || !senderId) {
        const err = { error: 'Missing chatId or senderId' };
        ack?.(err);
        return socket.emit('message_error', err);
      }

      if (isRateLimited(senderId)) {
        const err = { error: 'RATE_LIMITED' };
        ack?.(err);
        return socket.emit('message_error', err);
      }

      let existing = null;
      if (clientId) {
        existing = await Message.getByClientId(clientId);
      }

      const chat = await Chat.getById(chatId);
      if (!chat) {
        const err = { error: 'CHAT_NOT_FOUND' };
        ack?.(err);
        socket.emit('message_error', err);
        return;
      }
      if (chat.type === 'direct') {
        if (![chat.user1Id, chat.user2Id].includes(senderId)) {
          const err = { error: 'NOT_IN_CHAT' };
          ack?.(err);
          socket.emit('message_error', err);
          return;
        }
      } else if (!(await Chat.isParticipant(chatId, senderId))) {
        const err = { error: 'NOT_IN_CHAT' };
        ack?.(err);
        socket.emit('message_error', err);
        return;
      }

      const message = existing || await Message.create({
        chatId,
        senderId,
        text,
        messageType,
        mediaUrl,
        mediaName,
        clientId,
      });

      if (!existing) {
        io.to(`chat_${chatId}`).emit('new_message', message);
        io.to(`chat_${chatId}`).emit('message_new', message);
      }

      const payloadSent = { ...message, chatId };
      socket.emit('message_sent', payloadSent);
      ack?.({ ok: true, message: payloadSent });

      // Confirmer la livraison si le destinataire est connectÇ‰
      if (message.receiverId) {
        const receiverId = String(message.receiverId);
        const isReceiverOnline = await isUserOnline(receiverId);
        if (isReceiverOnline) {
          io.to(`user_${senderId}`).emit('message_delivered', {
            messageId: message.id,
            chatId,
            receiverId,
            deliveredAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const err = { error: 'Failed to send message', clientId: data?.clientId };
      ack?.(err);
      socket.emit('message_error', err);
    }
  });

  // Typing indicators
  socket.on('typing', (data) => {
    const chatId = data?.chatId;
    const userId = data?.userId || socket.data.userId;
    if (!chatId || !userId) return;
    io.to(`chat_${chatId}`).emit('typing', { chatId, userId, isTyping: data?.isTyping == true });
  });
  socket.on('typing_start', (data) => {
    const chatId = data?.chatId;
    const userId = data?.userId || socket.data.userId;
    if (!chatId || !userId) return;
    io.to(`chat_${chatId}`).emit('typing', { chatId, userId, isTyping: true });
  });
  socket.on('typing_stop', (data) => {
    const chatId = data?.chatId;
    const userId = data?.userId || socket.data.userId;
    if (!chatId || !userId) return;
    io.to(`chat_${chatId}`).emit('typing', { chatId, userId, isTyping: false });
  });

  // Online status
  socket.on('user_online', async () => {
    try {
      const userId = String(socket.data.userId || '');
      if (!userId) return;
      await broadcastPresence(userId, true);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const userId = socket.data.userId;
    if (userId) {
      await broadcastPresence(userId, false);
    }
  });
});

/* =========================
   404 + Error handlers
========================= */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// DEBUG: List all registered routes (use only in dev)
if (process.env.NODE_ENV === 'development') {
  app.get('/__routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((m) => {
      if (m.route) {
        const methods = Object.keys(m.route.methods).join(',').toUpperCase();
        routes.push(`${methods.padEnd(6)} ${m.route.path}`);
      } else if (m.name === 'router' && m.handle.stack) {
        m.handle.stack.forEach((h) => {
          const route = h.route;
          if (route) {
            const methods = Object.keys(route.methods).join(',').toUpperCase();
            const prefix = m.regexp?.toString().replace(/\\\//g, '/').replace(/[?^$]/g, '') || '';
            routes.push(`${methods.padEnd(6)} ${prefix}${route.path}`);
          }
        });
      }
    });

    const sorted = routes.sort();
    console.log('\nRegistered routes:\n' + sorted.join('\n'));
    res.type('text').send(sorted.join('\n'));
  });
}

/* =========================
   Start
========================= */
const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Socket.IO server ready');
      console.log('Remember to set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL accordingly.');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
