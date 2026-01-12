import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';

final socketServiceProvider = Provider<SocketService>((ref) {
  throw UnimplementedError('SocketService must be provided before use');
});

enum SocketEventType {
  connected,
  disconnected,
  newMessage,
  messageSent,
  messageError,
  messageRead,
  messageDelivered,
  chatRead,
  userOnline,
  userOffline,
  typing,
  presence,
}

class SocketEvent {
  const SocketEvent(this.type, this.data);

  final SocketEventType type;
  final dynamic data;
}

class SocketService {
  SocketService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;
  final Logger _logger = Logger('SocketService');
  io.Socket? _socket;
  final _eventController = StreamController<SocketEvent>.broadcast();

  Stream<SocketEvent> get events => _eventController.stream;

  Future<void> connect({String? token}) async {
    await disconnect();
    final resolvedToken = token ?? await _apiClient.currentToken();
    final uri = _apiClient.socketBaseUrl;
    _logger.info('Connecting to socket $uri');

    final opts = io.OptionBuilder()
        .setTransports(['websocket'])
        .enableForceNew()
        .enableReconnection()
        .setReconnectionAttempts(50)
        .setReconnectionDelay(500)
        .setReconnectionDelayMax(2000)
        .setTimeout(5000)
        .disableAutoConnect()
        .setExtraHeaders({
          if (resolvedToken != null) 'Authorization': 'Bearer $resolvedToken',
        })
        .build();

    final socket = io.io(uri, opts);
    _socket = socket;
    socket.onConnect((_) {
      _logger.info('Socket connected');
      _eventController.add(const SocketEvent(SocketEventType.connected, null));
    });
    socket.onDisconnect((_) {
      _logger.warning('Socket disconnected');
      _eventController
          .add(const SocketEvent(SocketEventType.disconnected, null));
    });
    socket.onError((err) {
      _logger.severe('Socket error', err);
      _eventController.add(SocketEvent(SocketEventType.messageError, err));
    });
    socket.on('new_message', (data) {
      _logger.fine('Received new_message event');
      _eventController.add(SocketEvent(SocketEventType.newMessage, data));
    });
    socket.on('message_new', (data) {
      _logger.fine('Received message_new event');
      _eventController.add(SocketEvent(SocketEventType.newMessage, data));
    });
    socket.on('message_sent', (data) {
      _eventController.add(SocketEvent(SocketEventType.messageSent, data));
    });
    socket.on('message_read', (data) {
      _eventController.add(SocketEvent(SocketEventType.messageRead, data));
    });
    socket.on('message_delivered', (data) {
      _eventController.add(SocketEvent(SocketEventType.messageDelivered, data));
    });
    socket.on('chat_read', (data) {
      _eventController.add(SocketEvent(SocketEventType.chatRead, data));
    });
    socket.on('message_error', (data) {
      _eventController.add(SocketEvent(SocketEventType.messageError, data));
    });
    socket.on('user_online', (data) {
      _eventController.add(SocketEvent(SocketEventType.userOnline, data));
    });
    socket.on('user_offline', (data) {
      _eventController.add(SocketEvent(SocketEventType.userOffline, data));
    });
    socket.on('typing', (data) {
      _eventController.add(SocketEvent(SocketEventType.typing, data));
    });
    socket.on('user_presence', (data) {
      _eventController.add(SocketEvent(SocketEventType.presence, data));
    });
    socket.connect();
  }

  Future<void> disconnect() async {
    if (_socket != null) {
      _logger.info('Closing socket connection');
      _socket!.dispose();
      _socket = null;
    }
  }

  void joinUser(String userId) {
    if (_socket == null) {
      _logger.warning('Cannot join room before socket is connected');
      return;
    }
    _logger.info('Joining personal room for user $userId');
    _socket!
      ..emit('join', {'userId': userId})
      ..emit('user_online', {'userId': userId});
  }

  void emit(String event, dynamic data) {
    _logger.fine('Emitting event $event with payload $data');
    _socket?.emit(event, data);
  }

  void dispose() {
    disconnect();
    _eventController.close();
  }
}
