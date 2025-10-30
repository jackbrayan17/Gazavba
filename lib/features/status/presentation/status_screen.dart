import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../core/models/status.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../chat/controllers/chat_controller.dart';
import '../controllers/status_controller.dart';

class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(statusControllerProvider);
    final controller = ref.read(statusControllerProvider.notifier);
    final chatState = ref.watch(chatControllerProvider);
    final authState = ref.watch(authControllerProvider);

    final currentUserId = authState.user?.id;
    final allowedUserIds = <String>{
      if (currentUserId != null) currentUserId,
      ...chatState.chats.expand((chat) => chat.participants.map((user) => user.id)),
    };

    final filtered = state.statuses
        .where((status) => allowedUserIds.contains(status.userId))
        .toList();
    final mutedSet = state.mutedUserIds;
    final activeStatuses = filtered.where((status) => !mutedSet.contains(status.userId)).toList();
    final mutedStatuses = filtered.where((status) => mutedSet.contains(status.userId)).toList();
    final hasStatuses = activeStatuses.isNotEmpty || mutedStatuses.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Statuts'),
        actions: [
          if (state.unseenCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(
                backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
                label: Text(
                  '${state.unseenCount} nouveaux',
                  style: Theme.of(context)
                      .textTheme
                      .labelMedium
                      ?.copyWith(color: Theme.of(context).colorScheme.onSecondaryContainer),
                ),
              ),
            ),
          IconButton(
            tooltip: 'Actualiser',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => controller.loadStatuses(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openComposer(context),
        icon: const Icon(Icons.edit_rounded),
        label: const Text('Nouveau statut'),
      ),
      body: RefreshIndicator(
        onRefresh: controller.loadStatuses,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: state.isLoading && !hasStatuses
              ? const _StatusLoading()
              : !hasStatuses
                  ? const _EmptyStatus()
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                      itemCount: 1 +
                          activeStatuses.length +
                          (mutedStatuses.isNotEmpty ? 1 + mutedStatuses.length : 0),
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return _ComposerCard(onTap: () => _openComposer(context));
                        }
                        index -= 1;
                        if (index < activeStatuses.length) {
                          final status = activeStatuses[index];
                          return _StatusTile(
                            status: status,
                            isMuted: false,
                            onViewed: () => controller.markViewed(status.id),
                            onToggleMute: () => controller.toggleMute(status.userId),
                            onToggleBlock: () => _confirmBlock(context, controller, status),
                            onDownload: () => _downloadStatus(context, controller, status),
                          );
                        }
                        index -= activeStatuses.length;
                        if (mutedStatuses.isNotEmpty) {
                          if (index == 0) {
                            return const _MutedSectionHeader();
                          }
                          index -= 1;
                          final status = mutedStatuses[index];
                          return _StatusTile(
                            status: status,
                            isMuted: true,
                            onViewed: () => controller.markViewed(status.id),
                            onToggleMute: () => controller.toggleMute(status.userId),
                            onToggleBlock: () => _confirmBlock(context, controller, status),
                            onDownload: () => _downloadStatus(context, controller, status),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
        ),
      ),
    );
  }

  Future<void> _openComposer(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (context) => const _StatusComposerSheet(),
    );
  }
}

Future<void> _downloadStatus(
  BuildContext context,
  StatusController controller,
  Status status,
) async {
  final result = await controller.download(status);
  if (result is Success<String>) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Statut enregistré dans ${result.value}')),
    );
  } else if (result is Failure<String>) {
    final error = result.error;
    final message = error is ApiException ? error.message : error.toString();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

Future<void> _confirmBlock(
  BuildContext context,
  StatusController controller,
  Status status,
) async {
  final confirm = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Bloquer ce statut ?'),
      content: Text(
        'Les statuts de ${status.userName ?? 'ce contact'} ne seront plus affichés. Vous pourrez les réactiver depuis vos paramètres.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).maybePop(false),
          child: const Text('Annuler'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).maybePop(true),
          child: const Text('Bloquer'),
        ),
      ],
    ),
  );
  if (confirm == true) {
    await controller.toggleBlock(status.userId);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Statuts de ${status.userName ?? 'ce contact'} bloqués.')),
    );
  }
}

class _ComposerCard extends StatelessWidget {
  const _ComposerCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Card(
        elevation: 3,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: colors.secondaryContainer,
                child: Icon(Icons.add_a_photo_outlined, color: colors.secondary),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  'Partager un moment sécurisé',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusTile extends StatelessWidget {
  const _StatusTile({
    required this.status,
    required this.isMuted,
    required this.onViewed,
    required this.onToggleMute,
    required this.onToggleBlock,
    this.onDownload,
  });

  final Status status;
  final bool isMuted;
  final Future<void> Function() onViewed;
  final Future<void> Function() onToggleMute;
  final Future<void> Function() onToggleBlock;
  final Future<void> Function()? onDownload;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final timeLabel = DateFormat('dd MMM • HH:mm').format(status.createdAt);
    final borderColor = isMuted
        ? colors.outlineVariant
        : status.hasViewed
            ? colors.outlineVariant
            : colors.secondary;

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: (status.hasViewed || isMuted) ? 0.6 : 1,
      child: Card(
        elevation: status.hasViewed || isMuted ? 0 : 4,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () async {
            await onViewed();
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: borderColor, width: 3),
                  ),
                  child: CircleAvatar(
                    radius: 30,
                    backgroundImage:
                        status.userAvatar != null ? NetworkImage(status.userAvatar!) : null,
                    child: status.userAvatar == null
                        ? Text(
                            (status.userName?.isNotEmpty ?? false)
                                ? status.userName![0].toUpperCase()
                                : '?',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.bold),
                          )
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
                              status.userName ?? 'Utilisateur Gazavba',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isMuted)
                            Container(
                              margin: const EdgeInsets.only(left: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: colors.surfaceVariant,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Text(
                                'Muté',
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(color: colors.onSurfaceVariant),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        status.content?.isNotEmpty == true
                            ? status.content!
                            : status.mediaUrl != null
                                ? 'Média partagé'
                                : 'Statut sans texte',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: colors.onSurfaceVariant),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$timeLabel • ${status.viewCount} vues',
                        style: Theme.of(context)
                            .textTheme
                            .labelSmall
                            ?.copyWith(color: colors.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                if (status.mediaUrl != null) ...[
                  const SizedBox(width: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Image.network(
                      status.mediaUrl!,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                    ),
                  ),
                ],
                PopupMenuButton<_StatusAction>(
                  tooltip: 'Plus d\'actions',
                  onSelected: (action) async {
                    switch (action) {
                      case _StatusAction.download:
                        if (onDownload != null) {
                          await onDownload!();
                        }
                        break;
                      case _StatusAction.mute:
                        await onToggleMute();
                        final messenger = ScaffoldMessenger.of(context);
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(
                              isMuted
                                  ? 'Statuts réactivés pour ${status.userName ?? 'ce contact'}.'
                                  : 'Statuts masqués pour ${status.userName ?? 'ce contact'}.',
                            ),
                          ),
                        );
                        break;
                      case _StatusAction.block:
                        await onToggleBlock();
                        break;
                    }
                  },
                  itemBuilder: (context) {
                    final items = <PopupMenuEntry<_StatusAction>>[];
                    if (status.mediaUrl != null) {
                      items.add(
                        const PopupMenuItem<_StatusAction>(
                          value: _StatusAction.download,
                          child: ListTile(
                            leading: Icon(Icons.download_rounded),
                            title: Text('Télécharger'),
                          ),
                        ),
                      );
                    }
                    items
                      ..add(
                        PopupMenuItem<_StatusAction>(
                          value: _StatusAction.mute,
                          child: ListTile(
                            leading: Icon(isMuted ? Icons.volume_up_rounded : Icons.volume_off_rounded),
                            title: Text(isMuted ? 'Réactiver ce statut' : 'Muter ce statut'),
                          ),
                        ),
                      )
                      ..add(
                        const PopupMenuItem<_StatusAction>(
                          value: _StatusAction.block,
                          child: ListTile(
                            leading: Icon(Icons.block_rounded),
                            title: Text('Bloquer ce contact'),
                          ),
                        ),
                      );
                    return items;
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MutedSectionHeader extends StatelessWidget {
  const _MutedSectionHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 4),
      child: Row(
        children: [
          const Icon(Icons.volume_off_rounded),
          const SizedBox(width: 8),
          Text(
            'Statuts masqués',
            style:
                Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

enum _StatusAction { download, mute, block }

class _StatusComposerSheet extends ConsumerStatefulWidget {
  const _StatusComposerSheet();

  @override
  ConsumerState<_StatusComposerSheet> createState() => _StatusComposerSheetState();
}

class _StatusComposerSheetState extends ConsumerState<_StatusComposerSheet> {
  final _controller = TextEditingController();
  final _picker = ImagePicker();
  XFile? _selectedFile;
  Uint8List? _previewBytes;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        top: 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: colors.primary),
              const SizedBox(width: 12),
              Text(
                'Créer un statut',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Fermer',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            maxLines: 3,
            decoration: const InputDecoration(
              hintText: 'Exprimez-vous…',
            ),
          ),
          const SizedBox(height: 16),
          if (_previewBytes != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.memory(
                _previewBytes!,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
          Row(
            children: [
              TextButton.icon(
                onPressed: _isSubmitting ? null : _pickImage,
                icon: const Icon(Icons.photo_library_rounded),
                label: const Text('Galerie'),
              ),
              const SizedBox(width: 12),
              TextButton.icon(
                onPressed: _isSubmitting ? null : _clearImage,
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Retirer'),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: _isSubmitting ? null : _submit,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(_isSubmitting ? 'Envoi…' : 'Partager'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
    if (file != null) {
      final bytes = await file.readAsBytes();
      setState(() {
        _selectedFile = file;
        _previewBytes = bytes;
      });
    }
  }

  void _clearImage() {
    setState(() {
      _selectedFile = null;
      _previewBytes = null;
    });
  }

  Future<void> _submit() async {
    final content = _controller.text.trim();
    if (content.isEmpty && _previewBytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ajoutez un message ou une image.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final notifier = ref.read(statusControllerProvider.notifier);
    Result<Status>? result;
    if (_selectedFile != null && _previewBytes != null) {
      final filename = _selectedFile!.name.isNotEmpty
          ? _selectedFile!.name
          : _selectedFile!.path.split('/').last;
      final multipart = MultipartFile.fromBytes(
        _previewBytes!,
        filename: filename,
      );
      result = await notifier.publishMedia(file: multipart, caption: content.isNotEmpty ? content : null);
    } else {
      result = await notifier.publishText(content);
    }

    setState(() {
      _isSubmitting = false;
    });

    if (result is Success<Status>) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Statut partagé avec succès !')),
      );
      Navigator.of(context).maybePop();
    } else if (result is Failure<Status>) {
      final error = result.error;
      final message = error is ApiException ? error.message : error.toString();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
  }
}

class _StatusLoading extends StatelessWidget {
  const _StatusLoading();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      itemCount: 5,
      itemBuilder: (context, index) => const _StatusSkeleton(),
    );
  }
}

class _EmptyStatus extends StatelessWidget {
  const _EmptyStatus();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.burst_mode_rounded, size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              'Partagez votre première story',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Ajoutez un texte ou une image pour inspirer vos contacts Gazavba.',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusSkeleton extends StatefulWidget {
  const _StatusSkeleton();

  @override
  State<_StatusSkeleton> createState() => _StatusSkeletonState();
}

class _StatusSkeletonState extends State<_StatusSkeleton>
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
    final colors = Theme.of(context).colorScheme;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 12),
          height: 96,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              colors: [
                colors.surfaceVariant.withOpacity(0.4),
                colors.surfaceVariant.withOpacity(0.15),
                colors.surfaceVariant.withOpacity(0.4),
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
