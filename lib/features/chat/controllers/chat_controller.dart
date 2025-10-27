import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/services/socket_service.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../../auth/controllers/auth_controller.dart';
import '../data/chat_repository.dart';

final chatControllerProvider =
    StateNotifierProvider<ChatController, ChatState>((ref) {
  final repository = ref.watch(chatRepositoryProvider);
  final socket = ref.watch(socketServiceProvider);
  final controller = ChatController(
    repository: repository,
    socketService: socket,
  );

  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    unawaited(controller.onAuthStateChanged(previous, next));
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
  });

  final List<Chat> chats;
  final Map<String, List<Message>> messagesByChat;
  final bool isLoading;
  final String? error;
  final String? activeChatId;

  ChatState copyWith({
    List<Chat>? chats,
    Map<String, List<Message>>? messagesByChat,
    bool? isLoading,
    String? error,
    bool clearError = false,
    String? activeChatId,
  }) {
    return ChatState(
      chats: chats ?? this.chats,
      messagesByChat: messagesByChat ?? this.messagesByChat,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      activeChatId: activeChatId ?? this.activeChatId,
    );
  }
}

class ChatController extends StateNotifier<ChatState> {
  ChatController({required this.repository, required this.socketService})
      : super(const ChatState());

  final ChatRepository repository;
  final SocketService socketService;
  StreamSubscription<SocketEvent>? _socketSubscription;
  final Logger _logger = Logger('ChatController');
  String? _userId;

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
      await socketService.disconnect();
      state = const ChatState();
    }
  }

  Future<void> loadChats() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final chats = await repository.fetchChats();
      state = state.copyWith(chats: chats, isLoading: false);
      _logger.info('Loaded ${chats.length} chats');
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning('Failed to load chats: ${error.message}');
    }
  }

  Future<Result<List<Message>>> loadMessages(String chatId) async {
    state = state.copyWith(isLoading: true, clearError: true, activeChatId: chatId);
    try {
      final messages = await repository.fetchMessages(chatId);
      final map = Map<String, List<Message>>.from(state.messagesByChat);
      map[chatId] = messages;
      state = state.copyWith(messagesByChat: map, isLoading: false);
      unawaited(repository.markChatAsRead(chatId));
      _logger.info('Fetched ${messages.length} messages for chat $chatId');
      return Success(messages);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning('Failed to load messages for $chatId: ${error.message}');
      return Failure(error);
    }
  }

  Future<Result<Message>> sendMessage(String chatId, String content) async {
    try {
      final message = await repository.sendMessage(chatId, content);
      final mine = message.copyWith(isMine: true);
      _upsertMessage(chatId, mine);
      socketService.emit('send_message', {
        'chatId': chatId,
        'senderId': _userId,
        'text': content,
        'messageType': message.messageType,
      });
      _logger.fine('Message sent to chat $chatId');
      return Success(message);
    } on ApiException catch (error) {
      _logger.warning('Failed to send message: ${error.message}');
      return Failure(error);
    }
  }

  void _handleSocketEvent(SocketEvent event) {
    switch (event.type) {
      case SocketEventType.connected:
        if (_userId != null) {
          socketService.joinUser(_userId!);
        }
        break;
      case SocketEventType.newMessage:
        _handleIncomingMessage(event.data);
        break;
      case SocketEventType.messageSent:
        _handleIncomingMessage(event.data);
        break;
      case SocketEventType.messageError:
        _logger.warning('Socket message error: ${event.data}');
        break;
      default:
        break;
    }
  }

  void _handleIncomingMessage(dynamic data) {
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
    final mine = message.copyWith(isMine: message.senderId == _userId);
    _upsertMessage(resolvedChatId, mine);
  }

  void _upsertMessage(String chatId, Message message) {
    final existing = List<Message>.from(state.messagesByChat[chatId] ?? const []);
    final index = existing.indexWhere((item) => item.id == message.id);
    if (index >= 0) {
      existing[index] = message;
    } else {
      existing.add(message);
    }
    final updatedMap = Map<String, List<Message>>.from(state.messagesByChat)
      ..[chatId] = existing;

    final updatedChats = state.chats.map((chat) {
      if (chat.id == chatId) {
        return chat.copyWith(lastMessage: message, updatedAt: DateTime.now());
      }
      return chat;
    }).toList();

    state = state.copyWith(messagesByChat: updatedMap, chats: updatedChats);
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    super.dispose();
  }
}
