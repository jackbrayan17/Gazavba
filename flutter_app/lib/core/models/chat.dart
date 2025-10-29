import 'dart:typed_data';

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
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    final participantsJson = json['participants'] as List<dynamic>? ?? [];
    return Chat(
      id: json['id'].toString(),
      title: (json['title'] ?? json['name'] ?? 'Conversation') as String,
      participants: participantsJson
          .map((item) => User.fromJson(item as Map<String, dynamic>))
          .toList(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now(),
      lastMessage: json['lastMessage'] != null
          ? Message.fromJson(json['lastMessage'] as Map<String, dynamic>)
          : null,
      unreadCount: json['unreadCount'] is num ? (json['unreadCount'] as num).toInt() : 0,
      isMuted: json['isMuted'] == true,
    );
  }

  final String id;
  final String title;
  final List<User> participants;
  final DateTime updatedAt;
  final Message? lastMessage;
  final int unreadCount;
  final bool isMuted;

  String? get avatarUrl => participants.firstWhereOrNull((p) => p.avatarUrl != null)?.avatarUrl;
  Uint8List? get avatarBytes =>
      participants.firstWhereOrNull((p) => p.avatarBytes != null)?.avatarBytes;

  Chat copyWith({
    String? id,
    String? title,
    List<User>? participants,
    DateTime? updatedAt,
    Message? lastMessage,
    int? unreadCount,
    bool? isMuted,
  }) {
    return Chat(
      id: id ?? this.id,
      title: title ?? this.title,
      participants: participants ?? this.participants,
      updatedAt: updatedAt ?? this.updatedAt,
      lastMessage: lastMessage ?? this.lastMessage,
      unreadCount: unreadCount ?? this.unreadCount,
      isMuted: isMuted ?? this.isMuted,
    );
  }
}
