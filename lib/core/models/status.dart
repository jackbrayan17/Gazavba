import '../utils/url_utils.dart';

class Status {
  const Status({
    required this.id,
    required this.userId,
    required this.createdAt,
    required this.expiresAt,
    this.durationSeconds,
    this.content,
    this.mediaUrl,
    this.userName,
    this.userAvatar,
    this.viewCount = 0,
    this.hasViewed = false,
  });

  factory Status.fromJson(Map<String, dynamic> json) {
    return Status(
      id: json['id'].toString(),
      userId: json['userId']?.toString() ?? json['user_id']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ??
              json['created_at'] as String? ??
              '') ??
          DateTime.now(),
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ??
              json['expires_at'] as String? ??
              '') ??
          DateTime.now().add(const Duration(hours: 24)),
      durationSeconds: _asInt(json['durationSeconds'] ?? json['duration']),
      content: json['content'] as String?,
      mediaUrl: UrlUtils.resolveMediaUrl(
        json['mediaUrl'] as String? ?? json['media_url'] as String?,
      ),
      userName: json['userName'] as String? ?? json['user_name'] as String?,
      userAvatar: UrlUtils.resolveMediaUrl(
        json['userAvatar'] as String? ?? json['user_avatar'] as String?,
      ),
      viewCount: _asInt(json['viewCount'] ?? json['view_count']),
      hasViewed: (json['hasViewed'] ?? json['has_viewed']) == true ||
          (json['hasViewed'] == 1 || json['has_viewed'] == 1),
    );
  }

  final String id;
  final String userId;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int? durationSeconds;
  final String? content;
  final String? mediaUrl;
  final String? userName;
  final String? userAvatar;
  final int viewCount;
  final bool hasViewed;

  Status copyWith({
    bool? hasViewed,
    int? viewCount,
    int? durationSeconds,
  }) {
    return Status(
      id: id,
      userId: userId,
      createdAt: createdAt,
      expiresAt: expiresAt,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      content: content,
      mediaUrl: mediaUrl,
      userName: userName,
      userAvatar: userAvatar,
      viewCount: viewCount ?? this.viewCount,
      hasViewed: hasViewed ?? this.hasViewed,
    );
  }
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}
