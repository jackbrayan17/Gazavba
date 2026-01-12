import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/utils/result.dart';
import '../../auth/controllers/auth_controller.dart';
import '../controllers/chat_controller.dart';
import 'chat_info_screen.dart';
import 'widgets/chat_wallpaper.dart';
import 'widgets/message_context_menu.dart';
import '../../contacts/controllers/contacts_controller.dart';
import '../../../core/models/contact.dart';

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
  final _picker = ImagePicker();
  bool _hasScrolledListener = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(chatControllerProvider.notifier).loadMessages(widget.chatId);
    });
  }

  @override
  void dispose() {
    ref
        .read(chatControllerProvider.notifier)
        .stopRealtimeForChat(widget.chatId);
    ref
        .read(chatControllerProvider.notifier)
        .notifyTyping(widget.chatId, false, updateLocal: false);
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Unified listeners
    ref.listen<ChatState>(chatControllerProvider, (previous, next) {
      // 1. Scroll listener
      final prevCount = previous?.messagesByChat[widget.chatId]?.length ?? 0;
      final nextCount = next.messagesByChat[widget.chatId]?.length ?? 0;
      if (nextCount > prevCount) {
        _scrollToBottom();
      }

      // 2. Error listener
      if (next.error != null && next.error != previous?.error) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            backgroundColor: Theme.of(context).colorScheme.error,
            behavior: SnackBarBehavior.floating,
            action: next.error!.toLowerCase().contains('token')
                ? SnackBarAction(
                    label: 'Connexion',
                    textColor: Colors.white,
                    onPressed: () => context.go('/auth/login'),
                  )
                : null,
          ),
        );
      }
    });

    final authState = ref.watch(authControllerProvider);
    final myId = authState.user?.id;
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

    final others = chat.participants.where((user) => user.id != myId).toList();
    final primaryOther = others.isNotEmpty ? others.first : null;
    final displayTitle = () {
      if (primaryOther != null && primaryOther.name.isNotEmpty) {
        return primaryOther.name;
      }
      if ((widget.title ?? '').isNotEmpty) {
        return widget.title!;
      }
      if (chat.title.isNotEmpty) {
        return chat.title;
      }
      if (others.isNotEmpty) {
        return others.first.name;
      }
      return 'Conversation';
    }();

    final messages = (chatState.messagesByChat[widget.chatId] ??
            const <Message>[])
        .map((message) => message.senderId == authState.user?.id
            ? message.copyWith(isMine: true)
            : message)
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final typing = chatState.typingByChat[widget.chatId] == true;
    final participantIds = chat.participants.map((user) => user.id).toSet();
    final online =
        participantIds.intersection(chatState.onlineUserIds).isNotEmpty;

    final statusLabel = typing
        ? 'En train d\'écrire...'
        : online
            ? 'En ligne'
            : 'Hors ligne';

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: SafeArea(
        child: Column(
          children: [
            // Custom AppBar with modern design
            _ModernAppBar(
              chat: chat,
              displayTitle: displayTitle,
              statusLabel: statusLabel,
              typing: typing,
              online: online,
            ),
            // Contact management banner
            if (chat.type != 'group' && primaryOther != null)
              _ContactActionBanner(user: primaryOther),
            // Messages area
            Expanded(
              child: messages.isEmpty
                  ? const _EmptyConversation()
                  : Container(
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerLowest,
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(32),
                          topRight: Radius.circular(32),
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(32),
                          topRight: Radius.circular(32),
                        ),
                        child: ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 20),
                          itemCount: messages.length,
                          itemBuilder: (context, index) {
                            final message = messages[index];
                            final showDateHeader = index == 0 ||
                                !_isSameDay(message.createdAt,
                                    messages[index - 1].createdAt);
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (showDateHeader)
                                  _DateHeader(date: message.createdAt),
                                Align(
                                  alignment: message.isMine
                                      ? Alignment.centerRight
                                      : Alignment.centerLeft,
                                  child: _ModernMessageBubble(message: message),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    ),
            ),
            // Modern input bar
            _ModernInputBar(
              controller: _messageController,
              onChanged: (value) {
                ref.read(chatControllerProvider.notifier).notifyTyping(
                    widget.chatId, value.trim().isNotEmpty,
                    updateLocal: false);
              },
              onSend: chatState.isLoading ? () {} : _send,
              isLoading: chatState.isLoading,
              onPickAttachment: _pickFromGallery,
              onOpenCamera: _openCamera,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickFromGallery() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 82,
      );
      if (file == null) return;
      final result = await ref
          .read(chatControllerProvider.notifier)
          .sendMediaMessage(widget.chatId, file, messageType: 'image');
      if (mounted && result.isFailure) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Envoi impossible: ${result.error}')),
        );
      } else {
        await _scrollToBottom();
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Impossible de charger le fichier: $error')),
      );
    }
  }

  Future<void> _openCamera() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 82,
      );
      if (file == null) return;
      final result = await ref
          .read(chatControllerProvider.notifier)
          .sendMediaMessage(widget.chatId, file, messageType: 'image');
      if (mounted && result.isFailure) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Envoi impossible: ${result.error}')),
        );
      } else {
        await _scrollToBottom();
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Erreur lors de l\'ouverture de la camera: $error')),
      );
    }
  }

  Future<void> _send() async {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;
    _messageController.clear();
    final result = await ref
        .read(chatControllerProvider.notifier)
        .sendMessage(widget.chatId, content);
    if (!mounted) return;
    if (result.isFailure) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Envoi impossible: ${result.error}')),
      );
    }
    ref
        .read(chatControllerProvider.notifier)
        .notifyTyping(widget.chatId, false, updateLocal: false);
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

class _ModernAppBar extends StatelessWidget {
  const _ModernAppBar({
    required this.chat,
    required this.displayTitle,
    required this.statusLabel,
    required this.typing,
    required this.online,
  });

  final Chat chat;
  final String displayTitle;
  final String statusLabel;
  final bool typing;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Back button with modern style
          Container(
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
              onPressed: () => Navigator.of(context).pop(),
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ),
          const SizedBox(width: 12),
          // Avatar and info
          Expanded(
            child: GestureDetector(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => ChatInfoScreen(chat: chat),
                ),
              ),
              child: Row(
                children: [
                  Hero(
                    tag: 'chat-avatar-${chat.id}',
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: online ? Colors.green : Colors.transparent,
                          width: 2.5,
                        ),
                      ),
                      child: CircleAvatar(
                        radius: 22,
                        backgroundImage: chat.avatarUrl != null
                            ? NetworkImage(chat.avatarUrl!)
                            : null,
                        child: chat.avatarUrl == null
                            ? Text(
                                displayTitle.characters.first.toUpperCase(),
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                              )
                            : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          displayTitle,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          statusLabel,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: typing
                                ? colorScheme.primary
                                : colorScheme.onSurfaceVariant,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Action buttons
          Container(
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: const Icon(Icons.call_rounded, size: 20),
              onPressed: () {},
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: const Icon(Icons.videocam_rounded, size: 20),
              onPressed: () {},
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModernMessageBubble extends StatelessWidget {
  const _ModernMessageBubble({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final bgColor =
        message.isMine ? colorScheme.primary : colorScheme.surfaceContainerHigh;
    final textColor =
        message.isMine ? colorScheme.onPrimary : colorScheme.onSurface;
    final time = DateFormat.Hm().format(message.createdAt);

    return GestureDetector(
      onLongPress: () {
        showModalBottomSheet(
          context: context,
          builder: (context) => MessageContextMenu(message: message),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(20),
              topRight: const Radius.circular(20),
              bottomLeft: message.isMine
                  ? const Radius.circular(20)
                  : const Radius.circular(4),
              bottomRight: message.isMine
                  ? const Radius.circular(4)
                  : const Radius.circular(20),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                offset: const Offset(0, 2),
                blurRadius: 8,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: message.isMine
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (!message.isMine &&
                  (message.senderName?.isNotEmpty ?? false)) ...[
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
                  borderRadius: BorderRadius.circular(12),
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
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: textColor,
                        height: 1.4,
                      ),
                ),
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: message.isMine
                    ? MainAxisAlignment.end
                    : MainAxisAlignment.start,
                children: [
                  Text(
                    time,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: textColor.withOpacity(0.6),
                          fontSize: 11,
                        ),
                  ),
                  if (message.isMine) ...[
                    const SizedBox(width: 4),
                    _MessageStatusIcon(message: message, color: textColor),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModernInputBar extends StatelessWidget {
  const _ModernInputBar({
    required this.controller,
    required this.onChanged,
    required this.onSend,
    required this.isLoading,
    required this.onPickAttachment,
    required this.onOpenCamera,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onSend;
  final bool isLoading;
  final VoidCallback onPickAttachment;
  final VoidCallback onOpenCamera;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, -2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Row(
        children: [
          // Attachment button
          Container(
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: const Icon(Icons.attach_file_rounded, size: 20),
              onPressed: onPickAttachment,
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ),
          const SizedBox(width: 8),
          // Text input
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                maxLines: null,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Aa. Let me check',
                  hintStyle: TextStyle(
                    color: colorScheme.onSurfaceVariant.withOpacity(0.6),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      Icons.emoji_emotions_outlined,
                      size: 20,
                      color: colorScheme.onSurfaceVariant,
                    ),
                    onPressed: () {},
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Send button
          Container(
            decoration: BoxDecoration(
              color: colorScheme.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: isLoading
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colorScheme.onPrimary,
                      ),
                    )
                  : Icon(
                      Icons.send_rounded,
                      size: 20,
                      color: colorScheme.onPrimary,
                    ),
              onPressed: isLoading ? null : onSend,
              padding: const EdgeInsets.all(8),
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          ),
        ],
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
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
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
              color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'Soyez le premier à envoyer un message sécurisé.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Les messages sont chiffrés et stockés sur gazavba.eeuez.com.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
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
    } else if (status == 'not_sent' || status == 'failed') {
      icon = Icons.error_outline_rounded;
      iconColor = Theme.of(context).colorScheme.error;
    } else if (status == 'sent') {
      icon = Icons.done_rounded;
    } else if (status == 'delivered') {
      icon = Icons.done_all_rounded;
    } else if (status == 'read' || message.readAt != null) {
      icon = Icons.done_all_rounded;
      iconColor = Theme.of(context).colorScheme.secondary;
    }

    return Icon(icon, size: 14, color: iconColor);
  }
}

class _ContactActionBanner extends StatefulWidget {
  const _ContactActionBanner({required this.user});

  final dynamic user;

  @override
  State<_ContactActionBanner> createState() => _ContactActionBannerState();
}

class _ContactActionBannerState extends State<_ContactActionBanner> {
  bool _isDismissed = false;

  @override
  Widget build(BuildContext context) {
    if (_isDismissed) return const SizedBox.shrink();

    return Consumer(
      builder: (context, ref, child) {
        final contactsState = ref.watch(contactsControllerProvider);
        final isContact = contactsState.contacts.any(
          (c) =>
              c.phone == widget.user.phone || c.accountUserId == widget.user.id,
        );

        if (isContact || contactsState.isLoading) {
          return const SizedBox.shrink();
        }

        final colorScheme = Theme.of(context).colorScheme;

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: colorScheme.outlineVariant.withOpacity(0.3),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: colorScheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.security_rounded,
                      size: 24,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Nouveau contact Gazavba',
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Souhaitez-vous ajouter ce numéro à vos contacts pour sécuriser vos échanges ?',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => setState(() => _isDismissed = true),
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    color: colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () {
                        // Logic block
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Signalement pris en compte.'),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                        setState(() => _isDismissed = true);
                      },
                      style: TextButton.styleFrom(
                        foregroundColor: colorScheme.error,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Bloquer'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        final contact = Contact(
                          id: 'new-${DateTime.now().millisecondsSinceEpoch}',
                          name: widget.user.name ?? widget.user.phone,
                          phone: widget.user.phone,
                          hasAccount: true,
                          accountUserId: widget.user.id,
                        );
                        ref
                            .read(contactsControllerProvider.notifier)
                            .saveContact(contact);
                      },
                      icon: const Icon(Icons.person_add_rounded, size: 18),
                      label: const Text('Ajouter'),
                      style: FilledButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
