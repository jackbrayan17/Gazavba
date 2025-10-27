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
    final items = _extractList(payload, 'chats');
    return items.map((item) => Chat.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<Message>> fetchMessages(String chatId) async {
    final payload = await _client.get('/messages/chat/$chatId');
    final items = _extractList(payload, 'messages');
    return items.map((item) => Message.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<Message> sendMessage(String chatId, String content) async {
    final payload = await _client.post(
      '/messages',
      data: {
        'chatId': chatId,
        'text': content,
      },
    );
    final message = payload['message'] as Map<String, dynamic>? ?? payload;
    return Message.fromJson(message);
  }

  Future<void> markChatAsRead(String chatId) async {
    await _client.post('/chats/$chatId/read');
  }
}

List<dynamic> _extractList(dynamic payload, String key) {
  if (payload is List<dynamic>) return payload;
  if (payload is Map<String, dynamic>) {
    if (payload[key] is List<dynamic>) {
      return payload[key] as List<dynamic>;
    }
    if (payload['data'] is List<dynamic>) {
      return payload['data'] as List<dynamic>;
    }
  }
  return const [];
}
