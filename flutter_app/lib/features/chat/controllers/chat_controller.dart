import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  StreamSubscription<Map<String, dynamic>>? _socketSubscription;

  Future<void> onAuthStateChanged(AuthState? previous, AuthState next) async {
    if (next.isAuthenticated) {
      await loadChats();
      await socketService.connect();
      _socketSubscription ??= socketService.messages.listen(_handleSocketEvent);
    } else {
      _socketSubscription?.cancel();
      _socketSubscription = null;
      state = const ChatState();
    }
  }

  Future<void> loadChats() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final chats = await repository.fetchChats();
      state = state.copyWith(chats: chats, isLoading: false);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
    }
  }

  Future<Result<List<Message>>> loadMessages(String chatId) async {
    state = state.copyWith(isLoading: true, clearError: true, activeChatId: chatId);
    try {
      final messages = await repository.fetchMessages(chatId);
      final map = Map<String, List<Message>>.from(state.messagesByChat);
      map[chatId] = messages;
      state = state.copyWith(messagesByChat: map, isLoading: false);
      return Success(messages);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      return Failure(error);
    }
  }

  Future<Result<Message>> sendMessage(String chatId, String content) async {
    try {
      final message = await repository.sendMessage(chatId, content);
      _upsertMessage(chatId, message.copyWith(isMine: true));
      return Success(message);
    } on ApiException catch (error) {
      return Failure(error);
    }
  }

  Future<void> muteChat(String chatId, {int? durationMinutes}) async {
    try {
      await repository.muteChat(chatId, durationMinutes: durationMinutes);
      final updatedChats = state.chats
          .map(
            (chat) => chat.id == chatId
                ? chat.copyWith(isMuted: true)
                : chat,
          )
          .toList();
      state = state.copyWith(chats: updatedChats);
    } catch (_) {
      // ignore
    }
  }

  void _handleSocketEvent(Map<String, dynamic> event) {
    final type = event['type'] as String? ?? '';
    if (type == 'message:new') {
      final data = event['data'] as Map<String, dynamic>?;
      if (data == null) return;
      final message = Message.fromJson(data);
      _upsertMessage(message.chatId, message);
    }
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
