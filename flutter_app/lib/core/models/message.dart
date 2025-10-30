class Message {
  const Message({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.isMine = false,
    this.status,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'].toString(),
      chatId: json['chatId']?.toString() ?? json['conversationId'].toString(),
      senderId: json['senderId']?.toString() ?? json['from'].toString(),
      content: (json['content'] ?? json['message'] ?? '') as String,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? json['sentAt'] as String? ?? '') ?? DateTime.now(),
      isMine: json['isMine'] == true,
      status: json['status'] as String?,
    );
  }

  final String id;
  final String chatId;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final bool isMine;
  final String? status;

  Map<String, dynamic> toJson() => {
        'id': id,
        'chatId': chatId,
        'senderId': senderId,
        'content': content,
        'createdAt': createdAt.toIso8601String(),
        'status': status,
        'isMine': isMine,
      };

  Message copyWith({
    bool? isMine,
    String? status,
  }) {
    return Message(
      id: id,
      chatId: chatId,
      senderId: senderId,
      content: content,
      createdAt: createdAt,
      isMine: isMine ?? this.isMine,
      status: status ?? this.status,
    );
  }
}
