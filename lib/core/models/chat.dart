import 'package:collection/collection.dart';

import 'message.dart';
import 'user.dart';

class Chat {
  const Chat({
    required this.id,
    required this.title,
    required this.participants,
    required this.updatedAt,
    this.lastMessage,
    this.unreadCount = 0,
    this.isMuted = false,
    this.avatar,
    this.type,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    final participantsJson = json['participants'] as List<dynamic>? ?? [];
    final lastMessageJson = json['lastMessage'] ?? json['last_message'];
    return Chat(
      id: json['id'].toString(),
      title: (json['displayName'] ??
              json['title'] ??
              json['name'] ??
              'Conversation') as String,
      participants: participantsJson
          .map((item) => User.fromJson(item as Map<String, dynamic>))
          .toList(),
      updatedAt: DateTime.tryParse(
            json['updatedAt'] as String? ??
                json['lastMessageAt'] as String? ??
                json['createdAt'] as String? ??
                '',
          ) ??
          DateTime.now(),
      lastMessage: lastMessageJson is Map<String, dynamic>
          ? Message.fromJson(lastMessageJson)
          : null,
      unreadCount: _asInt(json['unreadCount'] ?? json['unread_count']),
      isMuted: json['isMuted'] == true,
      avatar: json['avatar'] as String? ?? json['avatarUrl'] as String?,
      type: json['type'] as String? ?? json['chatType'] as String?,
    );
  }

  final String id;
  final String title;
  final List<User> participants;
  final DateTime updatedAt;
  final Message? lastMessage;
  final int unreadCount;
  final bool isMuted;
  final String? avatar;
  final String? type;

  String? get avatarUrl {
    if (avatar != null && avatar!.isNotEmpty) {
      return avatar;
    }
    return participants.firstWhereOrNull((p) => p.avatarUrl != null)?.avatarUrl;
  }

  Chat copyWith({
    String? id,
    String? title,
    List<User>? participants,
    DateTime? updatedAt,
    Message? lastMessage,
    int? unreadCount,
    bool? isMuted,
    String? avatar,
    String? type,
  }) {
    return Chat(
      id: id ?? this.id,
      title: title ?? this.title,
      participants: participants ?? this.participants,
      updatedAt: updatedAt ?? this.updatedAt,
      lastMessage: lastMessage ?? this.lastMessage,
      unreadCount: unreadCount ?? this.unreadCount,
      isMuted: isMuted ?? this.isMuted,
      avatar: avatar ?? this.avatar,
      type: type ?? this.type,
    );
  }
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.toInt();
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}
