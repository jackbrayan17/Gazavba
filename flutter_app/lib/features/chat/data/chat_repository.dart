import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/services/api_client.dart';
import '../../../core/services/socket_service.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  final socket = ref.watch(socketServiceProvider);
  return ChatRepository(client, socket);
});

class ChatRepository {
  ChatRepository(this._client, this._socketService);

  final ApiClient _client;
  final SocketService _socketService;

  Future<List<Chat>> fetchChats() async {
    final payload = await _client.get('/chats');
    final items = payload['chats'] as List<dynamic>? ?? payload['data'] as List<dynamic>? ?? [];
    return items.map((item) => Chat.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<Message>> fetchMessages(String chatId) async {
    final payload = await _client.get('/chats/$chatId/messages');
    final items = payload['messages'] as List<dynamic>? ?? payload['data'] as List<dynamic>? ?? [];
    return items.map((item) => Message.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<Message> sendMessage(String chatId, String content) async {
    final payload = await _client.post('/chats/$chatId/messages', data: {'content': content});
    final message = payload['message'] as Map<String, dynamic>? ?? payload;
    final parsed = Message.fromJson(message);
    _socketService.pushLocalMessage(parsed.toJson());
    return parsed;
  }

  Future<void> muteChat(String chatId, {int? durationMinutes}) async {
    await _client.post('/chats/$chatId/mute', data: {
      if (durationMinutes != null) 'durationMinutes': durationMinutes,
    });
  }
}
