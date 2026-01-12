import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:logging/logging.dart';

import '../../../core/models/contact.dart';
import '../../../core/models/status.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../chat/controllers/chat_controller.dart';
import '../../contacts/controllers/contacts_controller.dart';
import '../controllers/status_controller.dart';

class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logger = Logger('StatusScreen');
    final state = ref.watch(statusControllerProvider);
    final controller = ref.read(statusControllerProvider.notifier);
    final chatState = ref.watch(chatControllerProvider);
    final authState = ref.watch(authControllerProvider);
    final contactsState = ref.watch(contactsControllerProvider);

    final currentUserId = authState.user?.id;
    final allowedUserIds = <String>{
      if (currentUserId != null) currentUserId,
      ...chatState.chats
          .expand((chat) => chat.participants.map((user) => user.id)),
      ...contactsState.contacts
          .where((c) => (c.accountUserId?.isNotEmpty ?? false))
          .map((c) => c.accountUserId!),
      ...contactsState.contacts.where((c) => c.id.isNotEmpty).map((c) => c.id),
    };

    final filtered = state.statuses
        .where((status) => allowedUserIds.contains(status.userId))
        .toList();
    final mutedSet = state.mutedUserIds;
    final active =
        filtered.where((status) => !mutedSet.contains(status.userId)).toList();
    final muted =
        filtered.where((status) => mutedSet.contains(status.userId)).toList();
    final ownStatuses = active.where((s) => s.userId == currentUserId).toList();
    final contactActive =
        active.where((s) => s.userId != currentUserId).toList();
    final contactMuted = muted.where((s) => s.userId != currentUserId).toList();
    final hasStatuses = active.isNotEmpty || muted.isNotEmpty;
    logger.fine(
        'contacts=${contactsState.contacts.length}, allowed=${allowedUserIds.length}, active=${active.length}, muted=${muted.length}, own=${ownStatuses.length}, contactActive=${contactActive.length}, allowedSet=$allowedUserIds, statusUserIds=${state.statuses.map((s) => s.userId).toList()}');
    logger.fine(
        'contacts detail=${contactsState.contacts.map((c) => '${c.name}:${c.id}/${c.accountUserId} has=${c.hasAccount}').toList()}');

    final sections = <Widget>[
      _ComposerCard(onTap: () => _openComposer(context)),
      if (ownStatuses.isNotEmpty) ...[
        const SizedBox(height: 12),
        const _SectionHeader(
            title: 'Vos statuts', subtitle: 'Consultables par vos contacts'),
        const SizedBox(height: 8),
        ...ownStatuses.map((status) => _StatusTile(
              status: status,
              isOwner: true,
              isMuted: false,
              onViewed: () => controller.markViewed(status.id),
              onToggleMute: () => controller.toggleMute(status.userId),
              onToggleBlock: () => _confirmBlock(context, controller, status),
              onDownload: () => _downloadStatus(context, controller, status),
              onOpen: () => _openViewer(
                context: context,
                ref: ref,
                statuses: [...ownStatuses, ...contactActive, ...contactMuted],
                initialStatusId: status.id,
              ),
            )),
      ],
      if (contactActive.isNotEmpty) ...[
        const SizedBox(height: 16),
        const _SectionHeader(
            title: 'Contacts', subtitle: 'Statuts de vos contacts'),
        const SizedBox(height: 8),
        ...contactActive.map((status) => _StatusTile(
              status: status,
              isOwner: false,
              isMuted: false,
              onViewed: () => controller.markViewed(status.id),
              onToggleMute: () => controller.toggleMute(status.userId),
              onToggleBlock: () => _confirmBlock(context, controller, status),
              onDownload: () => _downloadStatus(context, controller, status),
              onOpen: () => _openViewer(
                context: context,
                ref: ref,
                statuses: [...ownStatuses, ...contactActive, ...contactMuted],
                initialStatusId: status.id,
              ),
            )),
      ],
      if (contactMuted.isNotEmpty) ...[
        const SizedBox(height: 16),
        const _MutedSectionHeader(),
        const SizedBox(height: 8),
        ...contactMuted.map((status) => _StatusTile(
              status: status,
              isOwner: false,
              isMuted: true,
              onViewed: () => controller.markViewed(status.id),
              onToggleMute: () => controller.toggleMute(status.userId),
              onToggleBlock: () => _confirmBlock(context, controller, status),
              onDownload: () => _downloadStatus(context, controller, status),
              onOpen: () => _openViewer(
                context: context,
                ref: ref,
                statuses: [...ownStatuses, ...contactActive, ...contactMuted],
                initialStatusId: status.id,
              ),
            )),
      ],
      const SizedBox(height: 120),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Statuts'),
        actions: [
          if (state.unseenCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(
                backgroundColor:
                    Theme.of(context).colorScheme.secondaryContainer,
                label: Text(
                  '${state.unseenCount} nouveaux',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color:
                          Theme.of(context).colorScheme.onSecondaryContainer),
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
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      children: sections,
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

  void _openViewer({
    required BuildContext context,
    required WidgetRef ref,
    required List<Status> statuses,
    required String initialStatusId,
  }) {
    final index = statuses.indexWhere((s) => s.id == initialStatusId);
    if (index < 0) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _StatusViewerScreen(
          statuses: statuses,
          initialIndex: index,
        ),
      ),
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
      SnackBar(content: Text('Statut enregistrÃ© dans ${result.value}')),
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
        'Les statuts de ${status.userName ?? 'ce contact'} ne seront plus affichÃ©s. Vous pourrez les rÃ©activer depuis vos paramÃ¨tres.',
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
      SnackBar(
          content:
              Text('Statuts de ${status.userName ?? 'ce contact'} bloquÃ©s.')),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
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
                child:
                    Icon(Icons.add_a_photo_outlined, color: colors.secondary),
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
    required this.isOwner,
    required this.isMuted,
    required this.onViewed,
    required this.onToggleMute,
    required this.onToggleBlock,
    this.onDownload,
    this.onOpen,
  });

  final Status status;
  final bool isOwner;
  final bool isMuted;
  final Future<void> Function() onViewed;
  final Future<void> Function() onToggleMute;
  final Future<void> Function() onToggleBlock;
  final Future<void> Function()? onDownload;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final timeLabel =
        DateFormat('dd MMM \u00e0 HH:mm').format(status.createdAt);
    final subtitle =
        isOwner ? '$timeLabel - ${status.viewCount} vues' : timeLabel;
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
            onOpen?.call();
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
                    backgroundImage: status.userAvatar != null
                        ? NetworkImage(status.userAvatar!)
                        : null,
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
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
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
                        subtitle,
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
                  tooltip: "Plus d'actions",
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
                            leading: Icon(isMuted
                                ? Icons.volume_up_rounded
                                : Icons.volume_off_rounded),
                            title: Text(isMuted
                                ? 'Réactiver ce statut'
                                : 'Muter ce statut'),
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
            'Statuts masquÃ©s',
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(fontWeight: FontWeight.w600),
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
  ConsumerState<_StatusComposerSheet> createState() =>
      _StatusComposerSheetState();
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
                'Creer un statut',
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
              hintText: 'Exprimez-vousâ€¦',
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
                label: Text(_isSubmitting ? 'Envoiâ€¦' : 'Partager'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _pickImage() async {
    final file =
        await _picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
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
      result = await notifier.publishMedia(
          file: multipart, caption: content.isNotEmpty ? content : null);
    } else {
      result = await notifier.publishText(content);
    }

    setState(() {
      _isSubmitting = false;
    });

    if (result is Success<Status>) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Statut partage avec succes !')),
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
            Icon(Icons.burst_mode_rounded,
                size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              'Partagez votre premiere story',
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

class _StatusViewerScreen extends ConsumerStatefulWidget {
  const _StatusViewerScreen({
    required this.statuses,
    required this.initialIndex,
  });

  final List<Status> statuses;
  final int initialIndex;

  @override
  ConsumerState<_StatusViewerScreen> createState() =>
      _StatusViewerScreenState();
}

class _StatusViewerScreenState extends ConsumerState<_StatusViewerScreen> {
  late final PageController _controller;
  late List<Status> _statuses;
  late List<double> _progress;
  late int _currentIndex;
  final _replyController = TextEditingController();
  Timer? _timer;
  bool _isPaused = false;
  bool _chromeVisible = true;
  Timer? _chromeTimer;
  bool _viewersSheetOpen = false;

  @override
  void initState() {
    super.initState();
    _statuses = List<Status>.from(widget.statuses);
    _progress = List<double>.filled(_statuses.length, 0);
    _currentIndex = widget.initialIndex;
    _controller = PageController(initialPage: widget.initialIndex);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _markViewed(_currentIndex);
      _prefetchAround(_currentIndex);
      _startProgress(reset: true);
      _scheduleHideChrome();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _chromeTimer?.cancel();
    _replyController.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _markViewed(int index) {
    if (index < 0 || index >= _statuses.length) return;
    final status = _statuses[index];
    if (status.hasViewed) return;
    ref.read(statusControllerProvider.notifier).markViewed(status.id);
    setState(() {
      _statuses[index] =
          status.copyWith(hasViewed: true, viewCount: status.viewCount + 1);
    });
  }

  int _statusDurationMs(Status status) {
    final url = status.mediaUrl ?? '';
    final isVideo =
        url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.mkv');
    final isImage = url.isNotEmpty && !isVideo;
    if (isVideo) return 30000;
    if (isImage) return 15000;
    return 8000;
  }

  void _startProgress({bool reset = false}) {
    _timer?.cancel();
    if (reset) {
      setState(() {
        _progress[_currentIndex] = 0;
      });
    }
    final totalMs = _statusDurationMs(_statuses[_currentIndex]);
    _timer = Timer.periodic(const Duration(milliseconds: 80), (timer) {
      if (!mounted || _isPaused) return;
      setState(() {
        _progress[_currentIndex] =
            (_progress[_currentIndex] + 80 / totalMs).clamp(0, 1);
      });
      if (_progress[_currentIndex] >= 1) {
        _goTo(index: _currentIndex + 1, resetProgress: true);
      }
    });
  }

  void _prefetchAround(int index) {
    for (final i in [index - 1, index + 1]) {
      if (i >= 0 && i < _statuses.length) {
        final url = _statuses[i].mediaUrl;
        if (url != null && url.isNotEmpty) {
          precacheImage(NetworkImage(url), context);
        }
      }
    }
  }

  void _goTo({required int index, bool resetProgress = false}) {
    if (index < 0) return;
    if (index >= _statuses.length) {
      if (_viewersSheetOpen && Navigator.of(context).canPop()) {
        Navigator.of(context).maybePop();
      }
      Navigator.of(context).maybePop();
      return;
    }
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
    );
    _currentIndex = index;
    _markViewed(index);
    _prefetchAround(index);
    _startProgress(reset: resetProgress);
    _scheduleHideChrome();
  }

  void _scheduleHideChrome() {
    _chromeTimer?.cancel();
    _chromeTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      setState(() => _chromeVisible = false);
    });
  }

  void _toggleChrome() {
    setState(() => _chromeVisible = !_chromeVisible);
    if (_chromeVisible) _scheduleHideChrome();
  }

  Future<void> _sendReply(Status status, String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    _replyController.clear();
    try {
      final contact = Contact(
        id: status.userId,
        name: status.userName ?? 'Contact',
        phone: '',
        hasAccount: true,
      );
      final chat = await ref
          .read(contactsControllerProvider.notifier)
          .startChat(contact);
      await ref
          .read(chatControllerProvider.notifier)
          .sendMessage(chat.id, trimmed);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reponse envoyee a ${contact.name}')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reponse impossible : $error')),
      );
    }
  }

  String _formatViewedAt(Contact viewer) {
    final raw = viewer.lastInteraction ?? DateTime.now();
    final label = DateFormat('dd MMM Ã  HH:mm').format(raw);
    final phone = viewer.phone.isNotEmpty ? viewer.phone : 'Contact';
    return '$phone Â· vu $label';
  }

  void _showViewers(Status status) {
    final isOwner = ref.read(authControllerProvider).user?.id == status.userId;
    _viewersSheetOpen = true;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (context) => FutureBuilder<Result<List<Contact>>>(
        future:
            ref.read(statusControllerProvider.notifier).fetchViewers(status.id),
        builder: (context, snapshot) {
          final result = snapshot.data;
          final viewers =
              result is Success<List<Contact>> ? result.value : <Contact>[];
          final isLoading = snapshot.connectionState == ConnectionState.waiting;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.remove_red_eye),
                    const SizedBox(width: 8),
                    Text(
                      'Vues du statut',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    if (isOwner) Text('${status.viewCount}'),
                  ],
                ),
                const SizedBox(height: 12),
                if (isLoading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (result is Failure<List<Contact>>)
                  Text(
                    'Impossible de charger les vues: ${result.error}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  )
                else if (viewers.isEmpty)
                  Text(
                    'Aucun viewer pour l\'instant.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  )
                else
                  ...viewers.map(
                    (viewer) {
                      final displayName = viewer.name.isNotEmpty
                          ? viewer.name
                          : (viewer.phone.isNotEmpty
                              ? viewer.phone
                              : 'Contact');
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundImage: viewer.avatarUrl != null
                              ? NetworkImage(viewer.avatarUrl!)
                              : null,
                          child: viewer.avatarUrl == null
                              ? Text(displayName.isNotEmpty
                                  ? displayName[0].toUpperCase()
                                  : '?')
                              : null,
                        ),
                        title: Text(displayName),
                        subtitle: Text(_formatViewedAt(viewer)),
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    ).whenComplete(() => _viewersSheetOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = ref.watch(authControllerProvider).user?.id;
    const reactions = ['ðŸ‘', 'â¤ï¸', 'ðŸ”¥', 'ðŸ˜‚', 'ðŸ‘'];

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (details) {
            final size = MediaQuery.of(context).size;
            final isRight = details.localPosition.dx > size.width / 2;
            final page = _controller.page ?? _controller.initialPage.toDouble();
            final next = isRight ? page.ceil() + 1 : page.floor() - 1;
            _goTo(index: next, resetProgress: true);
            _toggleChrome();
          },
          onLongPressStart: (_) => setState(() => _isPaused = true),
          onLongPressEnd: (_) => setState(() => _isPaused = false),
          child: Stack(
            children: [
              PageView.builder(
                controller: _controller,
                onPageChanged: (index) {
                  _currentIndex = index;
                  _markViewed(index);
                  _prefetchAround(index);
                  _startProgress(reset: true);
                  _scheduleHideChrome();
                },
                itemCount: _statuses.length,
                itemBuilder: (context, index) {
                  final status = _statuses[index];
                  final createdLabel =
                      DateFormat('dd MMM a HH:mm').format(status.createdAt);
                  final isOwner = currentUserId != null &&
                      status.userId.toString() == currentUserId.toString();
                  final durationLabel =
                      '${(_statusDurationMs(status) / 1000).round()}s';
                  return Stack(
                    children: [
                      Positioned.fill(
                        child: status.mediaUrl != null
                            ? Image.network(
                                status.mediaUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: Colors.black,
                                  alignment: Alignment.center,
                                  child: const Icon(Icons.broken_image_rounded,
                                      color: Colors.white70, size: 64),
                                ),
                              )
                            : Container(
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Color(0xFF1E1E2E),
                                      Color(0xFF0D0D11)
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                ),
                                padding: const EdgeInsets.all(24),
                                alignment: Alignment.center,
                                child: Text(
                                  status.content ?? '',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall
                                      ?.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                      ),
                      if (_chromeVisible)
                        Positioned(
                          top: 12,
                          left: 12,
                          right: 12,
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Container(
                                      height: 4,
                                      decoration: BoxDecoration(
                                        color: Colors.white24,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: FractionallySizedBox(
                                        alignment: Alignment.centerLeft,
                                        widthFactor: _progress[_currentIndex]
                                            .clamp(0, 1),
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius:
                                                BorderRadius.circular(12),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(durationLabel,
                                      style: const TextStyle(
                                          color: Colors.white70, fontSize: 12)),
                                  IconButton(
                                    onPressed: () =>
                                        Navigator.of(context).maybePop(),
                                    icon: const Icon(Icons.close_rounded,
                                        color: Colors.white),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  CircleAvatar(
                                    backgroundColor: Colors.white12,
                                    backgroundImage: status.userAvatar != null
                                        ? NetworkImage(status.userAvatar!)
                                        : null,
                                    child: status.userAvatar == null
                                        ? Text(
                                            (status.userName?.isNotEmpty ??
                                                    false)
                                                ? status.userName![0]
                                                    .toUpperCase()
                                                : '?',
                                            style: const TextStyle(
                                                color: Colors.white),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          status.userName ?? 'Contact',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium
                                              ?.copyWith(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w700),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          createdLabel,
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelMedium
                                              ?.copyWith(color: Colors.white70),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (isOwner)
                                    TextButton.icon(
                                      onPressed: () => _showViewers(status),
                                      icon: const Icon(Icons.remove_red_eye,
                                          color: Colors.white),
                                      label: Text(
                                        '${status.viewCount}',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      if (status.content != null &&
                          status.mediaUrl != null &&
                          _chromeVisible)
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: 120,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(
                              status.content!,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyLarge
                                  ?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w500),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              if (_chromeVisible)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 64,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: reactions
                        .map(
                          (emoji) => IconButton(
                            onPressed: () =>
                                _sendReply(_statuses[_currentIndex], emoji),
                            icon: Text(emoji,
                                style: const TextStyle(fontSize: 22)),
                          ),
                        )
                        .toList(),
                  ),
                ),
              if (_chromeVisible)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _replyController,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Repondreâ€¦',
                            hintStyle: const TextStyle(color: Colors.white70),
                            filled: true,
                            fillColor: Colors.black54,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      CircleAvatar(
                        backgroundColor: Colors.greenAccent,
                        child: IconButton(
                          icon: const Icon(Icons.send_rounded,
                              color: Colors.black87),
                          onPressed: () {
                            final status = _statuses[_currentIndex];
                            _sendReply(status, _replyController.text);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
