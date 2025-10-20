/* eslint-env node */
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./config/database');

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

/* =========================
   Middlewares
========================= */
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

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

/* =========================
   Routers (mounted with & without /api)
========================= */
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const chatsRouter = require('./routes/chats');
const messagesRouter = require('./routes/messages');
const statusesRouter = require('./routes/statuses');

// Without /api (if a proxy already strips /api)
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/chats', chatsRouter);
app.use('/messages', messagesRouter);
app.use('/statuses', statusesRouter);

// With /api (what your React Native client currently uses)
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/statuses', statusesRouter);

/* =========================
   Socket.IO
========================= */
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their room
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle new message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, senderId, text, messageType = 'text', mediaUrl = null, clientId = null } = data;

      const MessageModel = require('./models/Message');
      const UserModel = require('./models/User');
      const ChatModel = require('./models/Chat');

      // Save message
      const messageRecord = await MessageModel.create({
        chatId,
        senderId,
        text,
        messageType,
        mediaUrl,
        timestamp: new Date(),
      });

      const sender = await UserModel.getById(senderId);
      const chat = await ChatModel.getById(chatId);
      const participants = await ChatModel.getParticipants(chatId);

      const message = {
        ...messageRecord,
        senderName: sender?.name || 'Unknown',
        senderAvatar: sender?.avatar || null,
        clientId,
      };

      // Emit to all participants except sender
      participants.forEach((p) => {
        if (p.userId !== senderId) {
          io.to(`user_${p.userId}`).emit('new_message', {
            message,
            chatId,
            senderId,
            chatName: chat?.name || null,
            clientId,
          });
        }
      });

      // Emit back to sender for confirmation
      socket.emit('message_sent', { ...message, chatId });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message_error', { error: 'Failed to send message', clientId: data?.clientId });
    }
  });

  // Typing indicators
  socket.on('typing_start', (data) => {
    socket.to(`chat_${data.chatId}`).emit('user_typing', { userId: data.userId, isTyping: true });
  });
  socket.on('typing_stop', (data) => {
    socket.to(`chat_${data.chatId}`).emit('user_typing', { userId: data.userId, isTyping: false });
  });

  // Online status
  socket.on('user_online', (userId) => {
    socket.broadcast.emit('user_status', { userId, isOnline: true });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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

/* =========================
   Start
========================= */
initDatabase()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Socket.IO server ready');
      console.log('Remember to set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL accordingly.');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
