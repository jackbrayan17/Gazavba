import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';

final socketServiceProvider = Provider<SocketService>((ref) {
  throw UnimplementedError('SocketService must be provided before use');
});

class SocketService {
  SocketService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;
  final Logger _logger = Logger('SocketService');
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  io.Socket? _socket;

  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  Future<void> connect({String? token}) async {
    await disconnect();
    final resolvedToken = token ?? await _apiClient.currentToken();
    final uri = _apiClient.socketBaseUrl;

    final opts = io.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .setExtraHeaders({
          if (resolvedToken != null) 'Authorization': 'Bearer $resolvedToken',
        })
        .build();

    final socket = io.io(uri, opts);
    _socket = socket;
    socket.onConnect((_) {
      _logger.info('Socket connected');
    });
    socket.onDisconnect((_) {
      _logger.warning('Socket disconnected');
    });
    socket.onError((err) {
      _logger.severe('Socket error', err);
    });
    socket.on('new_message', (data) {
      _messageController.add({'type': 'message:new', 'data': data});
    });
    socket.on('message_new', (data) {
      _messageController.add({'type': 'message:new', 'data': data});
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
    _socket?.emit(event, data);
  }

  void pushLocalMessage(Map<String, dynamic> message) {
    if (!_messageController.isClosed) {
      _messageController.add({
        'type': 'message:new',
        'data': message,
      });
    }
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
