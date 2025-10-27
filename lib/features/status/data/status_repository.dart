import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/status.dart';
import '../../../core/services/api_client.dart';

final statusRepositoryProvider = Provider<StatusRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return StatusRepository(client);
});

class StatusRepository {
  StatusRepository(this._client);

  final ApiClient _client;

  Future<List<Status>> fetchStatuses() async {
    final payload = await _client.get('/statuses');
    final items = _extractList(payload, 'statuses');
    return items.map((item) => Status.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<Status>> fetchUserStatuses(String userId) async {
    final payload = await _client.get('/statuses/user/$userId');
    final items = _extractList(payload, 'statuses');
    return items.map((item) => Status.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<Status> createTextStatus(String content) async {
    final payload = await _client.post('/statuses/text', data: {'content': content});
    final json = (payload['status'] as Map<String, dynamic>?) ?? payload;
    return Status.fromJson(json);
  }

  Future<Status> createMediaStatus({
    required MultipartFile file,
    String? content,
  }) async {
    final formData = FormData.fromMap({
      'media': file,
      if (content != null && content.isNotEmpty) 'content': content,
    });
    final payload = await _client.post('/statuses/media', formData: formData);
    final json = (payload['status'] as Map<String, dynamic>?) ?? payload;
    return Status.fromJson(json);
  }

  Future<void> markAsViewed(String statusId) async {
    await _client.post('/statuses/$statusId/view');
  }

  Future<int> unseenCount() async {
    final payload = await _client.get('/statuses/unseen/count');
    if (payload['count'] is int) {
      return payload['count'] as int;
    }
    if (payload['count'] is String) {
      return int.tryParse(payload['count'] as String) ?? 0;
    }
    return 0;
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
