import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../auth/controllers/auth_controller.dart';
import '../controllers/chat_controller.dart';

class ChatDetailScreen extends ConsumerStatefulWidget {
  const ChatDetailScreen({
    super.key,
    required this.chatId,
    this.title,
    this.initialChat,
  });

  final String chatId;
  final String? title;
  final Chat? initialChat;

  @override
  ConsumerState<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends ConsumerState<ChatDetailScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(chatControllerProvider.notifier).loadMessages(widget.chatId);
    });
    ref.listen<ChatState>(chatControllerProvider, (previous, next) {
      final prevCount = previous?.messagesByChat[widget.chatId]?.length ?? 0;
      final nextCount = next.messagesByChat[widget.chatId]?.length ?? 0;
      if (nextCount > prevCount) {
        _scrollToBottom();
      }
    });
  }

  @override
  void dispose() {
    ref.read(chatControllerProvider.notifier).notifyTyping(widget.chatId, false);
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final chatState = ref.watch(chatControllerProvider);
    final chats = chatState.chats;
    final chat = widget.initialChat ??
        chats.firstWhere(
          (element) => element.id == widget.chatId,
          orElse: () => Chat(
            id: widget.chatId,
            title: widget.title ?? 'Conversation',
            participants: const [],
            updatedAt: DateTime.now(),
          ),
        );

    final messages = (chatState.messagesByChat[widget.chatId] ?? const <Message>[])
        .map((message) => message.senderId == authState.user?.id
            ? message.copyWith(isMine: true)
            : message)
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final typing = chatState.typingByChat[widget.chatId] == true;
    final participantIds = chat.participants.map((user) => user.id).toSet();
    final online = participantIds.intersection(chatState.onlineUserIds).isNotEmpty;
    DateTime? lastSeen;
    for (final id in participantIds) {
      final seen = chatState.lastSeenByUser[id];
      if (seen != null && (lastSeen == null || seen.isAfter(lastSeen))) {
        lastSeen = seen;
      }
    }
    final statusLabel = typing
        ? 'En train d\'écrire…'
        : online
            ? 'En ligne'
            : lastSeen != null
                ? 'Vu ${DateFormat('dd MMM • HH:mm').format(lastSeen)}'
                : (chat.participants.isEmpty
                    ? 'Conversation privée'
                    : 'Dernière connexion indisponible');
    final participantsLabel = chat.participants.isEmpty
        ? 'Conversation privée'
        : chat.participants.map((e) => e.name).join(', ');

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            Hero(
              tag: 'chat-avatar-${chat.id}',
              child: CircleAvatar(
                backgroundImage:
                    chat.avatarUrl != null ? NetworkImage(chat.avatarUrl!) : null,
                child: chat.avatarUrl == null
                    ? Text(chat.title.characters.first.toUpperCase())
                    : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    chat.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    statusLabel,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: typing ? Theme.of(context).colorScheme.primary : null),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (chat.participants.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      participantsLabel,
                      style: Theme.of(context)
                          .textTheme
                          .labelSmall
                          ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messages.isEmpty
                ? const _EmptyConversation()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final message = messages[index];
                      final showDateHeader = index == 0 ||
                          !_isSameDay(message.createdAt, messages[index - 1].createdAt);
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (showDateHeader)
                            _DateHeader(date: message.createdAt),
                          Align(
                            alignment: message.isMine
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: _MessageBubble(message: message),
                          ),
                        ],
                      );
                    },
                  ),
          ),
          const Divider(height: 1),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'Écrivez un message sécurisé…',
                      ),
                      onChanged: (value) {
                        ref
                            .read(chatControllerProvider.notifier)
                            .notifyTyping(widget.chatId, value.trim().isNotEmpty);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: chatState.isLoading ? null : _send,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.all(18),
                      shape: const CircleBorder(),
                    ),
                    child: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;
    _messageController.clear();
    await ref.read(chatControllerProvider.notifier).sendMessage(widget.chatId, content);
    ref.read(chatControllerProvider.notifier).notifyTyping(widget.chatId, false);
    await _scrollToBottom();
  }

  Future<void> _scrollToBottom() async {
    if (!_scrollController.hasClients) return;
    await Future.delayed(const Duration(milliseconds: 120));
    await _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final bgColor = message.isMine ? colorScheme.primary : colorScheme.surfaceVariant;
    final textColor = message.isMine ? colorScheme.onPrimary : colorScheme.onSurface;
    final time = DateFormat.Hm().format(message.createdAt);

    return AnimatedScale(
      duration: const Duration(milliseconds: 200),
      scale: 1,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(20),
            topRight: const Radius.circular(20),
            bottomLeft: message.isMine ? const Radius.circular(20) : const Radius.circular(6),
            bottomRight: message.isMine ? const Radius.circular(6) : const Radius.circular(20),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(message.isMine ? 0.12 : 0.06),
              offset: const Offset(0, 4),
              blurRadius: 8,
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment:
              message.isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!message.isMine && (message.senderName?.isNotEmpty ?? false)) ...[
              Text(
                message.senderName!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: textColor.withOpacity(0.7),
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 4),
            ],
            if (message.mediaUrl != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: 3 / 4,
                  child: Image.network(
                    message.mediaUrl!,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (message.content.trim().isNotEmpty)
              Text(
                message.content,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: textColor),
              ),
            Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment:
                  message.isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
              children: [
                Text(
                  time,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: textColor.withOpacity(0.7),
                      ),
                ),
                if (message.isMine) ...[
                  const SizedBox(width: 6),
                  _MessageStatusIcon(message: message, color: textColor),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final label = DateFormat('EEEE d MMMM', 'fr_FR').format(date);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.secondaryContainer,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSecondaryContainer,
                ),
          ),
        ),
      ),
    );
  }
}

class _EmptyConversation extends StatelessWidget {
  const _EmptyConversation();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.lock_outline_rounded,
              size: 72,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              'Soyez le premier à envoyer un message sécurisé.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Les messages sont chiffrés et stockés sur gazavba.eeuez.com.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageStatusIcon extends StatelessWidget {
  const _MessageStatusIcon({required this.message, required this.color});

  final Message message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    IconData icon = Icons.done_rounded;
    Color iconColor = color.withOpacity(0.7);

    final status = message.status ?? '';
    if (status == 'pending' || status == 'sending') {
      icon = Icons.access_time_rounded;
      iconColor = color.withOpacity(0.6);
    } else if (status == 'sent') {
      icon = Icons.done_rounded;
    } else if (status == 'delivered') {
      icon = Icons.done_all_rounded;
    } else if (status == 'read' || message.readAt != null) {
      icon = Icons.done_all_rounded;
      iconColor = Theme.of(context).colorScheme.secondary;
    }

    return Icon(icon, size: 16, color: iconColor);
  }
}
