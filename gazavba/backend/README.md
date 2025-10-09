# Gazavba Backend

Node.js backend for the Gazavba messaging app with SQLite database and Socket.IO for real-time messaging.

## Features

- **Authentication**: JWT-based auth with registration/login
- **Real-time messaging**: Socket.IO for instant message delivery
- **User management**: Profile management, online status, search
- **Chat system**: Direct and group chats with participants
- **Status updates**: Text and media statuses with expiration
- **File uploads**: Avatar and status media uploads
- **Database**: SQLite with proper relationships

## Setup

1. **Install dependencies**
```bash
cd backend
npm install
```

2. **Environment setup**
Create a `.env` file:
```
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here
DB_PATH=./database.sqlite
UPLOAD_PATH=./uploads
```

3. **Initialize database**
```bash
npm run init-db
```

4. **Start server**
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/avatar` - Upload avatar
- `POST /api/users/online` - Set online status

### Chats
- `GET /api/chats` - Get user's chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat details
- `GET /api/chats/:id/participants` - Get chat participants
- `POST /api/chats/:id/participants` - Add participant
- `DELETE /api/chats/:id/participants/:userId` - Remove participant
- `POST /api/chats/:id/read` - Mark chat as read

### Messages
- `GET /api/messages/chat/:chatId` - Get chat messages
- `POST /api/messages` - Send message
- `POST /api/messages/:messageId/read` - Mark message as read
- `DELETE /api/messages/:messageId` - Delete message
- `GET /api/messages/chat/:chatId/unread` - Get unread count

### Statuses
- `GET /api/statuses` - Get all statuses
- `GET /api/statuses/user/:userId` - Get user's statuses
- `POST /api/statuses/text` - Create text status
- `POST /api/statuses/media` - Create media status
- `POST /api/statuses/:statusId/view` - Mark status as viewed
- `GET /api/statuses/:statusId/viewers` - Get status viewers
- `DELETE /api/statuses/:statusId` - Delete status
- `GET /api/statuses/unseen/count` - Get unseen count

## Socket.IO Events

### Client → Server
- `join` - Join user room
- `send_message` - Send message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `user_online` - Set user online

### Server → Client
- `new_message` - New message received
- `message_sent` - Message sent confirmation
- `message_error` - Message send error
- `user_typing` - User typing indicator
- `user_status` - User online/offline status

## Database Schema

- **users**: User profiles and online status
- **chats**: Chat rooms (direct/group)
- **chat_participants**: Chat membership
- **messages**: Chat messages with read status
- **statuses**: User status updates
- **status_views**: Status view tracking
- **message_reads**: Message read receipts

## File Structure

```
backend/
├── config/
│   └── database.js          # Database configuration
├── models/
│   ├── User.js              # User model
│   ├── Chat.js              # Chat model
│   ├── Message.js           # Message model
│   └── Status.js            # Status model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User routes
│   ├── chats.js             # Chat routes
│   ├── messages.js          # Message routes
│   └── statuses.js          # Status routes
├── scripts/
│   └── init-db.js           # Database initialization
├── uploads/                  # File uploads directory
├── server.js                 # Main server file
└── package.json
```

## Development

The server runs on port 3000 by default. Socket.IO is configured for real-time messaging with CORS enabled for development.

For production deployment, consider:
- Using a production database (PostgreSQL, MySQL)
- Setting up proper file storage (AWS S3, etc.)
- Implementing rate limiting
- Adding proper logging
- Setting up monitoring
