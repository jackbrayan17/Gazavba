import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:characters/characters.dart';

import '../../../core/models/chat.dart';
import '../../../core/models/message.dart';
import '../../../core/models/user.dart';
import '../../auth/controllers/auth_controller.dart';
import '../controllers/chat_controller.dart';

class ChatsScreen extends ConsumerStatefulWidget {
  const ChatsScreen({super.key});

  @override
  ConsumerState<ChatsScreen> createState() => _ChatsScreenState();
}

class _ChatsScreenState extends ConsumerState<ChatsScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _query = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final chatState = ref.watch(chatControllerProvider);

    final chats = chatState.chats.where((chat) {
      if (_query.isEmpty) return true;
      final haystack =
      '${chat.title} ${_participants(chat.participants)}'.toLowerCase();
      return haystack.contains(_query);
    }).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discussions'),
        actions: [
          IconButton(
            tooltip: 'Actualiser',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () =>
                ref.read(chatControllerProvider.notifier).loadChats(),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Rechercher un contact ou une conversation',
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => _searchController.clear(),
                )
                    : null,
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                await ref.read(chatControllerProvider.notifier).loadChats();
              },
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: chatState.isLoading && chats.isEmpty
                    ? const _ChatsLoadingState()
                    : chats.isEmpty
                    ? _EmptyState(isAuthenticated: authState.isAuthenticated)
                    : ListView.separated(
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: chats.length,
                  separatorBuilder: (_, __) =>
                  const Divider(height: 1, indent: 88),
                  itemBuilder: (context, index) {
                    final chat = chats[index];
                    return _ChatListTile(chat: chat);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _participants(List<User> users) {
    return users.map((user) => user.name).join(', ');
  }
}

class _ChatListTile extends ConsumerWidget {
  const _ChatListTile({required this.chat});

  final Chat chat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lastMessage = chat.lastMessage;
    final subtitle =
    lastMessage != null ? _formatMessage(lastMessage) : 'Nouveau chat';
    final time = lastMessage?.createdAt ?? chat.updatedAt;
    final timeLabel = DateFormat.Hm().format(time);

    return InkWell(
      onTap: () => context.go(
        '/home/chats/conversation/${chat.id}',
        extra: {'title': chat.title, 'chat': chat},
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Hero(
              tag: 'chat-avatar-${chat.id}',
              child: CircleAvatar(
                radius: 28,
                backgroundImage:
                chat.avatarUrl != null ? NetworkImage(chat.avatarUrl!) : null,
                child: chat.avatarUrl == null
                    ? Text(chat.title.characters.first.toUpperCase())
                    : null,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          chat.title,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        timeLabel,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color:
                      Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (chat.unreadCount > 0)
              Container(
                margin: const EdgeInsets.only(left: 12),
                padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  chat.unreadCount.toString(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.onPrimary),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatMessage(Message message) {
    if (message.messageType != 'text' && message.mediaUrl != null) {
      switch (message.messageType) {
        case 'image':
          return '📷 Photo';
        case 'video':
          return '🎬 Vidéo';
        case 'audio':
          return '🎧 Audio';
        case 'file':
          return '📎 Fichier partagé';
      }
      return '📎 ${message.messageType}';
    }
    final preview = message.content.trim();
    if (preview.isEmpty) {
      return 'Message';
    }
    return preview;
  }
}

class _ChatsLoadingState extends StatelessWidget {
  const _ChatsLoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      itemCount: 6,
      padding: const EdgeInsets.all(16),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        return ShimmerWidget(
          height: 64,
          borderRadius: BorderRadius.circular(20),
        );
      },
    );
  }
}

class ShimmerWidget extends StatefulWidget {
  const ShimmerWidget({
    required this.height,
    required this.borderRadius,
    super.key,
  });

  final double height;
  final BorderRadius borderRadius;

  @override
  State<ShimmerWidget> createState() => _ShimmerWidgetState();
}

class _ShimmerWidgetState extends State<ShimmerWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius,
            gradient: LinearGradient(
              colors: [
                Theme.of(context)
                    .colorScheme
                    .surfaceVariant
                    .withOpacity(0.3),
                Theme.of(context)
                    .colorScheme
                    .surfaceVariant
                    .withOpacity(0.1),
                Theme.of(context)
                    .colorScheme
                    .surfaceVariant
                    .withOpacity(0.3),
              ],
              stops: const [0.1, 0.5, 0.9],
              transform: GradientRotation(_controller.value * 3.14),
            ),
          ),
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.isAuthenticated});

  final bool isAuthenticated;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.chat_bubble_outline_rounded,
              size: 72,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              isAuthenticated
                  ? 'Aucune conversation pour le moment'
                  : 'Connectez-vous pour voir vos conversations',
              style: textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              isAuthenticated
                  ? 'Invitez vos contacts ou lancez un nouveau message pour démarrer une discussion sécurisée.'
                  : 'Vos messages chiffrés apparaîtront ici après connexion.',
              style: textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
