/* eslint-env node */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path'); // Added path module
const fs = require('fs'); // Added fs module
const { initDatabase } = require('./config/database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Resolve upload directory
const resolveUploadDir = (value) => {
  if (!value) {
    return path.resolve(process.cwd(), 'uploads');
  }
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};

// Ensure upload directory exists
const uploadDir = resolveUploadDir(process.env.UPLOAD_PATH);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory at: ${uploadDir}`);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/statuses', require('./routes/statuses'));

// Socket.IO for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their room
  socket.on('join', (userId) => {
    if (!userId) {
      console.error('No userId provided for join event');
      return;
    }
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle new message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, senderId, text, messageType = 'text' } = data;
      if (!chatId || !senderId || !text) {
        throw new Error('Missing required message fields');
      }

      // Save message to database
      const MessageModel = require('./models/Message');
      const UserModel = require('./models/User');
      const messageRecord = await MessageModel.create({
        chatId,
        senderId,
        text,
        messageType,
        timestamp: new Date(),
      });

      const sender = await UserModel.getById(senderId);
      const message = {
        ...messageRecord,
        senderName: sender?.name || 'Unknown',
        senderAvatar: sender?.avatar || null,
      };

      // Get chat participants
      const ChatModel = require('./models/Chat');
      const chat = await ChatModel.getById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }
      const participants = await ChatModel.getParticipants(chatId);

      // Emit to all participants except sender
      participants.forEach((participant) => {
        if (participant.userId !== senderId) {
          io.to(`user_${participant.userId}`).emit('new_message', {
            message,
            chatId,
            senderId,
            chatName: chat.name,
          });
        }
      });

      // Emit back to sender for confirmation
      socket.emit('message_sent', message);
    } catch (error) {
      console.error('Error sending message:', error.message);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    if (!data?.chatId || !data?.userId) {
      console.error('Invalid typing_start data');
      return;
    }
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      userId: data.userId,
      isTyping: true,
    });
  });

  socket.on('typing_stop', (data) => {
    if (!data?.chatId || !data?.userId) {
      console.error('Invalid typing_stop data');
      return;
    }
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      userId: data.userId,
      isTyping: false,
    });
  });

  // Handle online status
  socket.on('user_online', (userId) => {
    if (!userId) {
      console.error('No userId provided for user_online event');
      return;
    }
    socket.broadcast.emit('user_status', {
      userId,
      isOnline: true,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
initDatabase()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Socket.IO server ready');
      console.log('Remember to point the Expo app to this host using EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL.');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });