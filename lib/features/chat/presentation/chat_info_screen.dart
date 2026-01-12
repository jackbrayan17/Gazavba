import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/chat.dart';

class ChatInfoScreen extends ConsumerStatefulWidget {
  const ChatInfoScreen({super.key, required this.chat});

  final Chat chat;

  @override
  ConsumerState<ChatInfoScreen> createState() => _ChatInfoScreenState();
}

class _ChatInfoScreenState extends ConsumerState<ChatInfoScreen> {
  bool _isMuted = false;
  String _disappearingMessages = 'Off';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: widget.chat.avatarUrl != null
                  ? Image.network(
                      widget.chat.avatarUrl!,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: colorScheme.primaryContainer,
                      child: Center(
                        child: Text(
                          widget.chat.title.characters.first.toUpperCase(),
                          style: theme.textTheme.displayLarge?.copyWith(
                            color: colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          SliverToBoxAdapter(
            child: Column(
              children: [
                const SizedBox(height: 16),
                Text(
                  widget.chat.title,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '+1 234 567 890', // Mock phone number
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                _buildActionButtons(context),
                const SizedBox(height: 16),
                const Divider(height: 1),
                _buildPrivacySection(context),
                const Divider(height: 1),
                _buildBlockReportSection(context),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _ActionButton(
          icon: Icons.call_outlined,
          label: 'Audio',
          onTap: () {},
        ),
        _ActionButton(
          icon: Icons.videocam_outlined,
          label: 'Vidéo',
          onTap: () {},
        ),
        _ActionButton(
          icon: Icons.search_outlined,
          label: 'Rechercher',
          onTap: () {},
        ),
      ],
    );
  }

  Widget _buildPrivacySection(BuildContext context) {
    return Column(
      children: [
        ListTile(
          leading: const Icon(Icons.notifications_outlined),
          title: const Text('Notifications'),
          trailing: Switch(
            value: !_isMuted,
            onChanged: (val) => setState(() => _isMuted = !val),
          ),
        ),
        ListTile(
          leading: const Icon(Icons.timer_outlined),
          title: const Text('Messages éphémères'),
          subtitle: Text(_disappearingMessages),
          onTap: () {
            // TODO: Show duration picker
          },
        ),
        ListTile(
          leading: const Icon(Icons.lock_outline),
          title: const Text('Chiffrement'),
          subtitle: const Text('Les messages sont chiffrés de bout en bout.'),
          trailing:
              const Icon(Icons.check_circle, color: Colors.green, size: 16),
          onTap: () {
            // TODO: Show encryption verification code
          },
        ),
      ],
    );
  }

  Widget _buildBlockReportSection(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        ListTile(
          leading: Icon(Icons.block_outlined, color: colorScheme.error),
          title: Text(
            'Bloquer ${widget.chat.title}',
            style: TextStyle(color: colorScheme.error),
          ),
          onTap: () {
            // TODO: Implement block logic
          },
        ),
        ListTile(
          leading: Icon(Icons.thumb_down_outlined, color: colorScheme.error),
          title: Text(
            'Signaler ${widget.chat.title}',
            style: TextStyle(color: colorScheme.error),
          ),
          onTap: () {
            // TODO: Implement report logic
          },
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          children: [
            Icon(icon, color: colorScheme.primary, size: 28),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: colorScheme.primary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
