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
    console.log(`[SocketService] initializing connection`, {
      socketUrl,
      hasToken: !!token,
      userId,
    });

    this.socket = io(socketUrl, {
      auth: { token },
      autoConnect: true,
      forceNew: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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

    this.socket.io?.on('reconnect_attempt', (attempt) => {
      console.log(`[SocketService] reconnect attempt #${attempt}`);
    });

    this.socket.io?.on('reconnect_failed', () => {
      console.warn('[SocketService] reconnection failed');
    });

    this.socket.io?.on('reconnect', (attempt) => {
      console.log(`[SocketService] reconnected after ${attempt} attempt(s)`);
    });

    this.socket.on('error', (error) => {
      console.error('[SocketService] socket error', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.io?.off('reconnect_attempt');
        this.socket.io?.off('reconnect_failed');
        this.socket.io?.off('reconnect');
      } catch (error) {
        console.warn('[SocketService] error while removing listeners', error);
      }
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
