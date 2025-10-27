class Message {
  const Message({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.isMine = false,
    this.status,
    this.messageType = 'text',
    this.mediaUrl,
    this.senderName,
    this.senderAvatar,
    this.readAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    final text = (json['text'] ?? json['content'] ?? json['message'] ?? '') as String;
    return Message(
      id: json['id'].toString(),
      chatId: json['chatId']?.toString() ?? json['conversationId']?.toString() ?? json['chat_id']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? json['from']?.toString() ?? '',
      content: text,
      createdAt: DateTime.tryParse(
            json['createdAt'] as String? ??
                json['sentAt'] as String? ??
                json['timestamp'] as String? ??
                '',
          ) ??
          DateTime.now(),
      isMine: json['isMine'] == true,
      status: json['status'] as String? ?? json['deliveryStatus'] as String?,
      messageType: (json['messageType'] ?? json['type'] ?? 'text') as String,
      mediaUrl: json['mediaUrl'] as String? ?? json['media_url'] as String?,
      senderName: json['senderName'] as String? ?? json['sender_name'] as String?,
      senderAvatar: json['senderAvatar'] as String? ?? json['sender_avatar'] as String?,
      readAt: DateTime.tryParse(json['readAt'] as String? ?? json['read_at'] as String? ?? ''),
    );
  }

  final String id;
  final String chatId;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final bool isMine;
  final String? status;
  final String messageType;
  final String? mediaUrl;
  final String? senderName;
  final String? senderAvatar;
  final DateTime? readAt;

  Message copyWith({
    bool? isMine,
    String? status,
    String? messageType,
    String? mediaUrl,
    String? senderName,
    String? senderAvatar,
    DateTime? readAt,
  }) {
    return Message(
      id: id,
      chatId: chatId,
      senderId: senderId,
      content: content,
      createdAt: createdAt,
      isMine: isMine ?? this.isMine,
      status: status ?? this.status,
      messageType: messageType ?? this.messageType,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      readAt: readAt ?? this.readAt,
    );
  }
}
