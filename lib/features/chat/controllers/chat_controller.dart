import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:logging/logging.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/services/socket_service.dart';
import '../../../core/services/notification_service.dart';
import '../../../core/services/notification_service_provider.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../../auth/controllers/auth_controller.dart';
import '../data/chat_repository.dart';

final chatControllerProvider =
    StateNotifierProvider<ChatController, ChatState>((ref) {
  final repository = ref.watch(chatRepositoryProvider);
  final socket = ref.watch(socketServiceProvider);
  final notificationService = ref.watch(notificationServiceProvider);

  final controller = ChatController(
    repository: repository,
    socketService: socket,
    notificationService: notificationService,
  );

  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    controller.onAuthStateChanged(previous, next);
  });

  return controller;
});

class ChatState {
  const ChatState({
    this.chats = const [],
    this.messagesByChat = const {},
    this.isLoading = false,
    this.error,
    this.activeChatId,
    this.typingByChat = const <String, dynamic>{},
    this.onlineUserIds = const {},
    this.lastSeenByUser = const {},
  });

  final List<Chat> chats;
  final Map<String, List<Message>> messagesByChat;
  final bool isLoading;
  final String? error;
  final String? activeChatId;

  /// chatId -> isTyping (bool) or userId (String)
  final Map<String, dynamic> typingByChat;
  final Set<String> onlineUserIds;
  final Map<String, DateTime> lastSeenByUser;

  ChatState copyWith({
    List<Chat>? chats,
    Map<String, List<Message>>? messagesByChat,
    bool? isLoading,
    String? error,
    bool clearError = false,
    String? activeChatId,
    Map<String, dynamic>? typingByChat,
    Set<String>? onlineUserIds,
    Map<String, DateTime>? lastSeenByUser,
  }) {
    return ChatState(
      chats: chats ?? this.chats,
      messagesByChat: messagesByChat ?? this.messagesByChat,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      activeChatId: activeChatId ?? this.activeChatId,
      typingByChat: typingByChat ?? this.typingByChat,
      onlineUserIds: onlineUserIds ?? this.onlineUserIds,
      lastSeenByUser: lastSeenByUser ?? this.lastSeenByUser,
    );
  }
}

class ChatController extends StateNotifier<ChatState> {
  ChatController({
    required this.repository,
    required this.socketService,
    required this.notificationService,
  }) : super(const ChatState());

  final ChatRepository repository;
  final SocketService socketService;
  final NotificationService notificationService;
  StreamSubscription<SocketEvent>? _socketSubscription;
  final Logger _logger = Logger('ChatController');
  String? _userId;
  final Random _random = Random();
  Timer? _realtimeTimer;
  bool _realtimeSyncInProgress = false;

  Future<void> onAuthStateChanged(AuthState? previous, AuthState next) async {
    if (next.isAuthenticated) {
      _userId = next.user?.id;
      await loadChats();
      await socketService.connect();
      _socketSubscription ??= socketService.events.listen(_handleSocketEvent);
    } else {
      _userId = null;
      _socketSubscription?.cancel();
      _socketSubscription = null;
      _stopRealtimeSync();
      await socketService.disconnect();
      state = const ChatState();
    }
  }

  Future<void> loadChats() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final chats = await repository.fetchChats();
      final onlineUsers = chats
          .expand((chat) => chat.participants)
          .where((user) => user.isOnline)
          .map((user) => user.id)
          .toSet();
      state = state.copyWith(
        chats: chats,
        isLoading: false,
        onlineUserIds: onlineUsers,
      );
      _logger.info('Loaded ${chats.length} chats');
      if (chats.isNotEmpty) {
        final titles =
            chats.map((chat) => '[${chat.id}] ${chat.title}').join(', ');
        _logger.info('Chats loaded: $titles');
      } else {
        _logger.info('No chats available to display.');
      }
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning('Failed to load chats: ${error.message}');
    }
  }

  Future<Result<List<Message>>> loadMessages(String chatId) async {
    if (!mounted) return Failure(ApiException('Controller disposed'));
    state =
        state.copyWith(isLoading: true, clearError: true, activeChatId: chatId);
    _startRealtimeSync(chatId);
    try {
      final messages = await repository.fetchMessages(chatId);
      if (!mounted) return Success(messages);
      final map = Map<String, List<Message>>.from(state.messagesByChat);
      map[chatId] = messages;
      state = state.copyWith(messagesByChat: map, isLoading: false);
      repository.markChatAsRead(chatId);
      _logger.info('Fetched ${messages.length} messages for chat $chatId');
      return Success(messages);
    } on ApiException catch (error) {
      if (mounted) {
        state = state.copyWith(isLoading: false, error: error.message);
      }
      _logger.warning('Failed to load messages for $chatId: ${error.message}');
      return Failure(error);
    }
  }

  Future<Result<Message>> sendMessage(String chatId, String content) async {
    final clientId = _generateClientId();
    final pending = Message(
      id: clientId,
      chatId: chatId,
      senderId: _userId ?? '',
      content: content,
      createdAt: DateTime.now(),
      isMine: true,
      status: 'pending',
      clientId: clientId,
    );
    _upsertMessage(chatId, pending);
    try {
      final message =
          await repository.sendMessage(chatId, content, clientId: clientId);
      final mine = message.copyWith(
        isMine: true,
        status: message.status ?? 'sent',
        clientId: message.clientId ?? clientId,
      );
      _upsertMessage(chatId, mine);
      socketService.emit('send_message', {
        'chatId': chatId,
        'senderId': _userId,
        'text': content,
        'messageType': message.messageType,
        'clientId': clientId,
      });
      _logger.fine('Message sent to chat $chatId');
      return Success(message);
    } on ApiException catch (error) {
      _upsertMessage(chatId, pending.copyWith(status: 'not_sent'));
      _logger.warning('Failed to send message: ${error.message}');
      return Failure(error);
    }
  }

  Future<Result<Message>> sendMediaMessage(
    String chatId,
    XFile file, {
    String messageType = 'image',
  }) async {
    final clientId = _generateClientId();
    final pending = Message(
      id: clientId,
      chatId: chatId,
      senderId: _userId ?? '',
      content: file.name,
      createdAt: DateTime.now(),
      isMine: true,
      status: 'pending',
      messageType: messageType,
      clientId: clientId,
    );
    _upsertMessage(chatId, pending);
    try {
      final mediaUrl = await repository.uploadFile(file);
      final message = await repository.sendMessage(
        chatId,
        '',
        clientId: clientId,
        mediaUrl: mediaUrl,
        messageType: messageType,
        mediaName: file.name,
      );
      final mine = message.copyWith(
        isMine: true,
        status: message.status ?? 'sent',
        clientId: message.clientId ?? clientId,
      );
      _upsertMessage(chatId, mine);
      socketService.emit('send_message', {
        'chatId': chatId,
        'senderId': _userId,
        'text': null,
        'messageType': messageType,
        'mediaUrl': mediaUrl,
        'mediaName': file.name,
        'clientId': clientId,
      });
      _logger.fine('Media message sent to chat $chatId');
      return Success(message);
    } on ApiException catch (error) {
      _upsertMessage(chatId, pending.copyWith(status: 'not_sent'));
      _logger.warning('Failed to send media: ${error.message}');
      return Failure(error);
    }
  }

  String _generateClientId() {
    final now = DateTime.now().microsecondsSinceEpoch;
    final rand = _random.nextInt(0x7fffffff);
    return '$now-$rand';
  }

  void _startRealtimeSync(String chatId) {
    _realtimeTimer?.cancel();
    _realtimeTimer = Timer.periodic(
        const Duration(seconds: 1), (_) => _syncActiveChat(chatId));
  }

  void _stopRealtimeSync() {
    _realtimeTimer?.cancel();
    _realtimeTimer = null;
    _realtimeSyncInProgress = false;
  }

  Future<void> _syncActiveChat(String chatId) async {
    if (_realtimeSyncInProgress || !mounted) return;
    if (state.activeChatId != chatId) {
      _stopRealtimeSync();
      return;
    }
    _realtimeSyncInProgress = true;
    try {
      _pingPresence();
      var refreshedChats = state.chats;
      try {
        refreshedChats = await repository.fetchChats();
      } catch (error) {
        _logger.fine('Chat refresh skipped: $error');
      }

      final messages = await repository.fetchMessages(chatId);
      if (!mounted || state.activeChatId != chatId) return;
      final normalized = messages
          .map(
            (m) => m.copyWith(
              isMine: m.senderId == _userId,
              status: m.readAt != null
                  ? 'read'
                  : (m.status ?? (m.senderId == _userId ? 'sent' : m.status)),
              clientId:
                  (m.clientId ?? m.id).isNotEmpty ? m.clientId ?? m.id : m.id,
            ),
          )
          .toList();

      final existingLocal = state.messagesByChat[chatId] ?? const <Message>[];
      for (final local in existingLocal) {
        final exists = normalized.any(
          (m) =>
              m.id == local.id ||
              (m.clientId != null &&
                  local.clientId != null &&
                  m.clientId == local.clientId),
        );
        final isOwn = local.isMine || local.senderId == _userId;
        final isPending =
            (local.status == 'pending' || local.status == 'not_sent');
        if (!exists && isOwn && isPending) {
          normalized.add(local);
        }
      }
      normalized.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      final updatedMap = Map<String, List<Message>>.from(state.messagesByChat)
        ..[chatId] = normalized;

      final updatedChats = refreshedChats.map((chat) {
        if (chat.id != chatId) return chat;
        final latest =
            normalized.isNotEmpty ? normalized.last : chat.lastMessage;
        final unread = state.activeChatId == chatId ? 0 : chat.unreadCount;
        return chat.copyWith(
          lastMessage: latest ?? chat.lastMessage,
          updatedAt: latest?.createdAt ?? chat.updatedAt,
          unreadCount: unread,
        );
      }).toList();

      final onlineUsers = Set<String>.from(state.onlineUserIds);
      for (final chat in updatedChats) {
        for (final user in chat.participants) {
          if (user.isOnline) {
            onlineUsers.add(user.id);
          }
        }
      }

      state = state.copyWith(
        messagesByChat: updatedMap,
        chats: updatedChats,
        onlineUserIds: onlineUsers,
      );
    } catch (error, stack) {
      _logger.fine('Realtime sync skipped: $error');
      _logger.finest('Realtime sync stack: $stack');
    } finally {
      _realtimeSyncInProgress = false;
    }
  }

  void stopRealtimeForChat(String chatId) {
    if (state.activeChatId == chatId) {
      _stopRealtimeSync();
      state = state.copyWith(activeChatId: null);
    }
  }

  void _pingPresence() {
    if (_userId == null) return;
    socketService.emit('user_online', {'userId': _userId});
  }

  void notifyTyping(String chatId, bool isTyping, {bool updateLocal = true}) {
    socketService.emit('typing', {
      'chatId': chatId,
      'userId': _userId,
      'isTyping': isTyping,
    });
    if (!updateLocal) return;
    final updated = <String, dynamic>{...state.typingByChat};
    if (isTyping && _userId != null) {
      updated[chatId] = true;
    } else {
      updated.remove(chatId);
    }
    state = state.copyWith(typingByChat: updated);
  }

  void _handleSocketEvent(SocketEvent event) {
    switch (event.type) {
      case SocketEventType.connected:
        if (_userId != null) socketService.joinUser(_userId!);
        break;
      case SocketEventType.newMessage:
      case SocketEventType.messageSent:
        _handleIncomingMessage(event.data, event.type);
        break;
      case SocketEventType.messageError:
        _logger.warning('Socket message error: ${event.data}');
        _handleFailedMessage(event.data);
        break;
      case SocketEventType.messageDelivered:
        _handleMessageDelivered(event.data);
        break;
      case SocketEventType.messageRead:
        _handleMessageRead(event.data);
        break;
      case SocketEventType.chatRead:
        _handleChatRead(event.data);
        break;
      case SocketEventType.userOnline:
        _handlePresence(event.data, isOnline: true);
        break;
      case SocketEventType.userOffline:
        _handlePresence(event.data, isOnline: false);
        break;
      case SocketEventType.typing:
        _handleTyping(event.data);
        break;
      case SocketEventType.presence:
        final isOnline = event.data is Map && event.data['isOnline'] == true;
        _handlePresence(event.data, isOnline: isOnline);
        break;
      default:
        break;
    }
  }

  void _handleIncomingMessage(dynamic data, SocketEventType type) {
    if (data is! Map) return;
    Map<String, dynamic>? messageJson;
    String? chatId;
    if (data['message'] is Map<String, dynamic>) {
      messageJson = (data['message'] as Map).cast<String, dynamic>();
      chatId = data['chatId']?.toString() ?? messageJson['chatId']?.toString();
    } else if (data is Map<String, dynamic>) {
      messageJson = data;
      chatId = data['chatId']?.toString() ?? data['chat_id']?.toString();
    }
    if (messageJson == null) return;
    if (chatId != null && !messageJson.containsKey('chatId')) {
      messageJson = Map<String, dynamic>.from(messageJson)..['chatId'] = chatId;
    }
    final message = Message.fromJson(messageJson!);
    final resolvedChatId = chatId ?? message.chatId;
    final isMine = message.senderId == _userId;
    final status = () {
      if (message.status == 'read' || message.readAt != null) return 'read';
      return message.status;
    }();
    final mine = message.copyWith(
      isMine: isMine,
      status: status,
    );
    _upsertMessage(resolvedChatId, mine);
  }

  void _upsertMessage(String chatId, Message message) {
    final existing =
        List<Message>.from(state.messagesByChat[chatId] ?? const []);
    final index = existing.indexWhere(
      (item) =>
          item.id == message.id ||
          (message.clientId != null &&
              message.clientId!.isNotEmpty &&
              item.clientId == message.clientId),
    );
    if (index >= 0) {
      existing[index] = message;
    } else {
      existing.add(message);
    }
    if (message.isMine) {
      final matchingChat = state.chats.where((c) => c.id == chatId);
      if (matchingChat.isNotEmpty) {
        final participants = matchingChat.first.participants;
        final someoneOnline = participants.any(
          (user) => user.id != _userId && state.onlineUserIds.contains(user.id),
        );
        if (someoneOnline) {
          final idx = existing.indexWhere((m) => m.id == message.id);
          if (idx >= 0) {
            final currentStatus = existing[idx].status;
            if (currentStatus != 'pending' && currentStatus != 'not_sent') {
              existing[idx] = existing[idx].copyWith(
                status: existing[idx].status == 'read'
                    ? existing[idx].status
                    : 'delivered',
              );
            }
          }
        }
      }
    }

    final updatedMap = Map<String, List<Message>>.from(state.messagesByChat)
      ..[chatId] =
          (existing..sort((a, b) => a.createdAt.compareTo(b.createdAt)));

    final updatedChats = state.chats.map((chat) {
      if (chat.id == chatId) {
        final shouldIncrement = !message.isMine && state.activeChatId != chatId;
        final unread = shouldIncrement
            ? (chat.unreadCount + 1)
            : message.isMine
                ? chat.unreadCount
                : 0;
        return chat.copyWith(
          lastMessage: message,
          updatedAt: DateTime.now(),
          unreadCount: unread,
        );
      }
      return chat;
    }).toList();

    final typingMap = <String, dynamic>{...state.typingByChat}..remove(chatId);

    state = state.copyWith(
      messagesByChat: updatedMap,
      chats: updatedChats,
      typingByChat: typingMap,
    );

    final allMessages =
        updatedMap.values.expand((messages) => messages).toList();
    notificationService.showLatestMessages(allMessages);

    if (!message.isMine && state.activeChatId == chatId) {
      // Marquer comme lu en direct quand la conversation est ouverte
      unawaited(repository.markChatAsRead(chatId));
    }
  }

  void _handleFailedMessage(dynamic data) {
    if (data is! Map) return;
    final messageId = data['messageId']?.toString();
    final clientId = data['clientId']?.toString();
    final chatId = data['chatId']?.toString();
    final updatedMap = Map<String, List<Message>>.from(state.messagesByChat);
    var changed = false;
    updatedMap.forEach((key, messages) {
      if (chatId != null && key != chatId) return;
      final idx = messages.indexWhere(
        (m) =>
            (messageId != null && m.id == messageId) ||
            (clientId != null &&
                clientId.isNotEmpty &&
                m.clientId != null &&
                m.clientId == clientId),
      );
      if (idx >= 0 &&
          (messages[idx].isMine || messages[idx].senderId == _userId)) {
        messages[idx] = messages[idx].copyWith(status: 'not_sent');
        changed = true;
      }
    });
    if (changed) {
      state = state.copyWith(messagesByChat: updatedMap);
    }
  }

  void _handleMessageDelivered(dynamic data) {
    if (data is! Map) return;
    final messageId = data['messageId']?.toString();
    final chatId = data['chatId']?.toString();
    _updateMessageStatus(
      chatId: chatId,
      messageId: messageId,
      status: 'delivered',
    );
  }

  void _handleMessageRead(dynamic data) {
    if (data is! Map) return;
    final messageId = data['messageId']?.toString();
    final chatId = data['chatId']?.toString();
    final readerId = data['userId']?.toString();
    if (readerId != null && readerId == _userId) return;
    final readAtStr = data['readAt']?.toString();
    final readAt = DateTime.tryParse(readAtStr ?? '') ?? DateTime.now();
    _updateMessageStatus(
      chatId: chatId,
      messageId: messageId,
      status: 'read',
      readAt: readAt,
    );
  }

  void _handleChatRead(dynamic data) {
    if (data is! Map) return;
    final chatId = data['chatId']?.toString();
    final readerId = data['userId']?.toString();
    if (chatId == null || (readerId != null && readerId == _userId)) return;
    final readAt = DateTime.tryParse(data['readAt']?.toString() ?? '');
    final messages = state.messagesByChat[chatId];
    if (messages == null) return;
    final updated = messages
        .map(
          (m) => m.isMine
              ? m.copyWith(
                  status: 'read',
                  readAt: m.readAt ?? readAt ?? DateTime.now(),
                )
              : m,
        )
        .toList();
    if (!_listEquals(messages, updated)) {
      final map = Map<String, List<Message>>.from(state.messagesByChat)
        ..[chatId] = updated;
      state = state.copyWith(messagesByChat: map);
    }
  }

  void _updateMessageStatus({
    required String? messageId,
    String? chatId,
    required String status,
    DateTime? readAt,
  }) {
    if (messageId == null) return;
    final updatedMap = Map<String, List<Message>>.from(state.messagesByChat);
    var changed = false;
    updatedMap.forEach((key, messages) {
      if (chatId != null && key != chatId) return;
      final idx = messages.indexWhere((m) => m.id == messageId);
      if (idx >= 0) {
        final msg = messages[idx];
        if (!msg.isMine) return;
        messages[idx] = msg.copyWith(
          status: status,
          readAt: readAt ?? msg.readAt ?? DateTime.now(),
        );
        changed = true;
      }
    });
    if (changed) {
      state = state.copyWith(messagesByChat: updatedMap);
    }
  }

  bool _listEquals(List<Message> a, List<Message> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      final ma = a[i];
      final mb = b[i];
      if (ma.id != mb.id ||
          ma.clientId != mb.clientId ||
          ma.status != mb.status ||
          ma.readAt != mb.readAt) {
        return false;
      }
    }
    return true;
  }

  void _handleTyping(dynamic data) {
    if (data is! Map) return;
    final chatId = data['chatId']?.toString();
    if (chatId == null) return;
    final isTyping = data['isTyping'] == true;
    final userId = data['userId']?.toString();
    final updated = <String, dynamic>{...state.typingByChat};
    if (isTyping && userId != null && userId != _userId) {
      updated[chatId] = true;
    } else {
      updated.remove(chatId);
    }
    state = state.copyWith(typingByChat: updated);
  }

  void _handlePresence(dynamic data, {required bool isOnline}) {
    if (data is! Map) return;
    final userId = data['userId']?.toString();
    if (userId == null) return;
    final updatedOnline = Set<String>.from(state.onlineUserIds);
    if (isOnline) {
      updatedOnline.add(userId);
    } else {
      updatedOnline.remove(userId);
    }
    final lastSeenMap = Map<String, DateTime>.from(state.lastSeenByUser);
    final lastSeenStr = data['lastSeen']?.toString();
    final lastSeen = DateTime.tryParse(lastSeenStr ?? '');
    if (lastSeen != null) {
      lastSeenMap[userId] = lastSeen;
    } else if (!isOnline) {
      lastSeenMap[userId] = DateTime.now();
    }
    state = state.copyWith(
      onlineUserIds: updatedOnline,
      lastSeenByUser: lastSeenMap,
    );

    if (isOnline && userId != _userId) {
      _markDeliveredForUser(userId);
    }
  }

  void _markDeliveredForUser(String userId) {
    final updatedMap = Map<String, List<Message>>.from(state.messagesByChat);
    var changed = false;
    for (final entry in updatedMap.entries) {
      final matching = state.chats.where((c) => c.id == entry.key);
      if (matching.isEmpty) continue;
      final participants = matching.first.participants;
      final isInChat = participants.any((u) => u.id == userId);
      if (!isInChat) continue;
      final updatedMessages = entry.value
          .map(
            (m) => m.isMine && (m.status == null || m.status == 'sent')
                ? m.copyWith(status: 'delivered')
                : m,
          )
          .toList();
      if (!_listEquals(entry.value, updatedMessages)) {
        updatedMap[entry.key] = updatedMessages;
        changed = true;
      }
    }
    if (changed) {
      state = state.copyWith(messagesByChat: updatedMap);
    }
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _stopRealtimeSync();
    super.dispose();
  }
}
