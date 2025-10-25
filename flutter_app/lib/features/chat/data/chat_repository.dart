import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/services/api_client.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return ChatRepository(client);
});

class ChatRepository {
  ChatRepository(this._client);

  final ApiClient _client;

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
    return Message.fromJson(message);
  }

  Future<void> muteChat(String chatId, {int? durationMinutes}) async {
    await _client.post('/chats/$chatId/mute', data: {
      if (durationMinutes != null) 'durationMinutes': durationMinutes,
    });
  }
}
