import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

final socketServiceProvider = Provider<SocketService>((ref) {
  throw UnimplementedError('SocketService must be provided before use');
});

class SocketService {
  SocketService();

  final _messageController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  Future<void> connect({String? token}) async {
    // No remote socket to open in offline mode.
  }

  Future<void> disconnect() async {
    // Nothing to close, kept for API parity.
  }

  void emit(String event, dynamic data) {
    // Intentionally left blank in local mode.
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
    _messageController.close();
  }
}
