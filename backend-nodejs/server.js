/* eslint-env node */
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./config/database');
const Chat = require('./models/Chat');
const User = require('./models/User');
const Message = require('./models/Message');

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
const activeSockets = new Map();

const setPresence = async (userId, isOnline) => {
  if (!userId) return;
  try {
    await User.setOnlineStatus(userId, isOnline);
    const user = await User.getById(userId);
    io.emit('user_presence', {
      userId,
      isOnline,
      lastSeen: user?.lastSeen,
    });
  } catch (error) {
    console.error('Presence update error:', error);
  }
};

const addSocket = async (userId, socketId) => {
  const set = activeSockets.get(userId) || new Set();
  const wasOffline = set.size === 0;
  set.add(socketId);
  activeSockets.set(userId, set);
  if (wasOffline) {
    await setPresence(userId, true);
  }
};

const removeSocket = async (userId, socketId) => {
  const set = activeSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    activeSockets.delete(userId);
    await setPresence(userId, false);
  } else {
    activeSockets.set(userId, set);
  }
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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their room
  socket.on('join', async (payload) => {
    const userId = String(payload?.userId || payload?.id || payload || '');
    if (!userId) return socket.emit('error', { message: 'Invalid user' });
    socket.data.userId = userId;
    await joinUserRooms(socket, userId);
    await addSocket(userId, socket.id);
    console.log(`User ${userId} joined their rooms`);
    socket.emit('joined', { userId });
  });

  // Handle new message
  socket.on('send_message', async (data) => {
    try {
      const payload = data || {};
      const chatId = payload.chatId;
      const senderId = payload.senderId || socket.data.userId;
      const text = payload.text;
      const messageType = payload.messageType || 'text';
      const mediaUrl = payload.mediaUrl || null;
      const mediaName = payload.mediaName || null;
      const clientId = payload.clientId || null;

      if (!chatId || !senderId) {
        return socket.emit('message_error', { error: 'Missing chatId or senderId' });
      }

      let existing = null;
      if (clientId) {
        existing = await Message.getByClientId(clientId);
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

      socket.emit('message_sent', { ...message, chatId });

      // Confirmer la livraison si le destinataire est connectÇ‰
      if (message.receiverId) {
        const receiverId = String(message.receiverId);
        const isReceiverOnline = activeSockets.has(receiverId) && activeSockets.get(receiverId)?.size > 0;
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
      socket.emit('message_error', { error: 'Failed to send message', clientId: data?.clientId });
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
  socket.on('user_online', async (payload) => {
    try {
      const userId = String(payload?.userId || payload || socket.data.userId || '');
      if (!userId) return;
      await addSocket(userId, socket.id);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const userId = socket.data.userId;
    if (userId) {
      await removeSocket(userId, socket.id);
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
