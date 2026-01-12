import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/services/api_client.dart';
import '../../../core/utils/exceptions.dart';

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
    return items
        .map((item) => Chat.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<Message>> fetchMessages(String chatId) async {
    final payload = await _client.get('/messages/chat/$chatId');
    final items = _extractList(payload, 'messages');
    return items
        .map((item) => Message.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Message> sendMessage(
    String chatId,
    String content, {
    String? clientId,
    String? mediaUrl,
    String? messageType,
    String? mediaName,
  }) async {
    final payload = await _client.post(
      '/messages',
      data: {
        'chatId': chatId,
        'text': content,
        if (clientId != null) 'clientId': clientId,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (mediaName != null) 'mediaName': mediaName,
        if (messageType != null) 'messageType': messageType,
      },
    );
    final message = payload['message'] as Map<String, dynamic>? ?? payload;
    return Message.fromJson(message);
  }

  Future<String> uploadFile(XFile file) async {
    final bytes = await file.readAsBytes();
    final name = (file.name).isNotEmpty ? file.name : 'upload.bin';
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: name),
    });
    final payload = await _client.post('/messages/upload', formData: formData);
    final url = payload['url'] as String? ?? payload['path'] as String?;
    if (url == null || url.isEmpty) {
      throw ApiException('Upload failed');
    }
    return url;
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
