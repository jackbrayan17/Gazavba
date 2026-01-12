import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/status.dart';
import '../../../core/models/contact.dart';
import '../../../core/services/api_client.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/url_utils.dart';

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
    return items
        .map((item) => Status.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<Status>> fetchUserStatuses(String userId) async {
    final payload = await _client.get('/statuses/user/$userId');
    final items = _extractList(payload, 'statuses');
    return items
        .map((item) => Status.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<Status> createTextStatus(String content) async {
    final payload = await _client.post(
      '/statuses',
      data: {
        'type': 'text',
        'content': content,
      },
    );
    final json = (payload['status'] as Map<String, dynamic>?) ?? payload;
    return Status.fromJson(json);
  }

  Future<Status> createMediaStatus({
    required MultipartFile file,
    String? content,
  }) async {
    final formData = FormData.fromMap({
      'type': 'media',
      'media': file,
      if (content != null && content.isNotEmpty) 'content': content,
    });
    final payload = await _client.post('/statuses', formData: formData);
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

  Future<String> downloadStatusMedia({
    required Status status,
    required String directoryPath,
  }) async {
    final url = status.mediaUrl;
    if (url == null || url.isEmpty) {
      throw ApiException('Aucun media a telecharger pour ce statut');
    }
    final extension = _inferExtension(url);
    final filename =
        'status_${status.id}_${DateTime.now().millisecondsSinceEpoch}.$extension';
    final savePath = '$directoryPath/$filename';
    final resolvedUrl = UrlUtils.resolveMediaUrl(url) ?? url;
    await _client.download(resolvedUrl, savePath);
    return savePath;
  }

  Future<List<Contact>> fetchViewers(String statusId) async {
    final payload = await _client.get(
      '/statuses/$statusId/viewers',
      query: {'wrap': 'true'},
    );
    final list = _extractList(payload, 'viewers');
    return list
        .map((item) => Contact.fromJson(
            (item as Map<String, dynamic>)..['hasAccount'] = true))
        .toList();
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

String _inferExtension(String url) {
  final lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.mp4')) return 'mp4';
  if (lower.endsWith('.mov')) return 'mov';
  if (lower.endsWith('.mkv')) return 'mkv';
  if (lower.endsWith('.mp3')) return 'mp3';
  if (lower.endsWith('.aac')) return 'aac';
  if (lower.endsWith('.wav')) return 'wav';
  return 'jpg';
}
