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
  io.Socket? _socket;
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  Future<void> connect({String? token}) async {
    await disconnect();
    final resolvedToken = token ?? await _apiClient.currentToken();
    final uri = _apiClient.socketBaseUrl;
    _logger.info('Connecting to socket $uri');

    final opts = io.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .setExtraHeaders({
          if (resolvedToken != null) 'Authorization': 'Bearer $resolvedToken',
        })
        .build();

    _socket = io.io(uri, opts);
    _socket!.onConnect((_) => _logger.info('Socket connected'));
    _socket!.onDisconnect((_) => _logger.warning('Socket disconnected'));
    _socket!.onError((err) => _logger.severe('Socket error', err));
    _socket!.on('message', (data) {
      if (data is Map<String, dynamic>) {
        _messageController.add(data);
      }
    });
    _socket!.connect();
  }

  Future<void> disconnect() async {
    if (_socket != null) {
      _logger.info('Closing socket connection');
      _socket!.dispose();
      _socket = null;
    }
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
