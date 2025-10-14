import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(token, userId) {
    if (this.socket) {
      this.disconnect();
    }

    const socketUrl = getSocketBaseUrl();

    this.socket = io(socketUrl, {
      auth: { token },
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected = true;
      this.socket.emit('join', userId);
      this.socket.emit('user_online', userId);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Message events
  onNewMessage(callback) {
    this.socket?.on('new_message', callback);
  }

  onMessageSent(callback) {
    this.socket?.on('message_sent', callback);
  }

  onMessageError(callback) {
    this.socket?.on('message_error', callback);
  }

  sendMessage(chatId, senderId, text, messageType = 'text', clientId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send_message', {
        chatId,
        senderId,
        text,
        messageType,
        clientId,
      });
    }
  }

  // Typing indicators
  onUserTyping(callback) {
    this.socket?.on('user_typing', callback);
  }

  startTyping(chatId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { chatId, userId });
    }
  }

  stopTyping(chatId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { chatId, userId });
    }
  }

  // User status events
  onUserStatus(callback) {
    this.socket?.on('user_status', callback);
  }

  setUserOnline(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user_online', userId);
    }
  }

  // Generic event listeners
  on(event, callback) {
    this.socket?.on(event, callback);
  }

  off(event, callback) {
    this.socket?.off(event, callback);
  }

  emit(event, data) {
    this.socket?.emit(event, data);
  }

  // Remove all listeners
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export default new SocketService();
