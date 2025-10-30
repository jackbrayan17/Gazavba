import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/contact.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../chat/controllers/chat_controller.dart';
import '../controllers/contacts_controller.dart';

class ContactsScreen extends ConsumerWidget {
  const ContactsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(contactsControllerProvider);
    final controller = ref.read(contactsControllerProvider.notifier);
    final authState = ref.watch(authControllerProvider);

    final contacts = state.contacts;
    final registered = contacts.where((c) => c.hasAccount).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final guests = contacts.where((c) => !c.hasAccount).toList()
      ..sort((a, b) => a.name.compareTo(b.name));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contacts Gazavba'),
        actions: [
          IconButton(
            tooltip: 'Actualiser',
            onPressed: controller.loadContacts,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openAddContactSheet(context, controller),
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Ajouter un contact'),
      ),
      body: RefreshIndicator(
        onRefresh: controller.loadContacts,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: state.isLoading && contacts.isEmpty
              ? const _ContactsLoading()
              : contacts.isEmpty
                  ? const _EmptyContacts()
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                      children: [
                        if (registered.isNotEmpty) ...[
                          _SectionHeader(
                            title: 'Déjà sur Gazavba',
                            subtitle: 'Lancez une conversation sécurisée en un clic',
                          ),
                          const SizedBox(height: 8),
                          ...registered.map(
                            (contact) => _ContactTile(
                              contact: contact,
                              isPendingInvite: state.pendingInvites.contains(contact.phone),
                              onMessage: () => _openMessageComposer(context, ref, contact),
                              onInvite: () => controller.inviteContact(contact),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                        if (guests.isNotEmpty) ...[
                          _SectionHeader(
                            title: 'Inviter des amis',
                            subtitle: 'Envoyez un lien d\'inscription multi-plateforme',
                          ),
                          const SizedBox(height: 8),
                          ...guests.map(
                            (contact) => _ContactTile(
                              contact: contact,
                              isPendingInvite: state.pendingInvites.contains(contact.phone),
                              onMessage: () => _openMessageComposer(context, ref, contact),
                              onInvite: () => controller.inviteContact(contact),
                            ),
                          ),
                        ],
                        const SizedBox(height: 32),
                        if (authState.user != null)
                          Card(
                            elevation: 2,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Synchronisation intelligente',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Les contacts ayant déjà échangé avec vous sont mis en avant et leurs statuts apparaissent automatiquement.',
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
        ),
      ),
    );
  }

  Future<void> _openAddContactSheet(
    BuildContext context,
    ContactsController controller,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (context) => _AddContactSheet(onSubmit: controller.addContact),
    );
  }

  Future<void> _openMessageComposer(
    BuildContext context,
    WidgetRef ref,
    Contact contact,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (context) => _MessageSheet(contact: contact, ref: ref),
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
          style:
              Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
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

class _ContactTile extends StatelessWidget {
  const _ContactTile({
    required this.contact,
    required this.isPendingInvite,
    required this.onMessage,
    required this.onInvite,
  });

  final Contact contact;
  final bool isPendingInvite;
  final VoidCallback onMessage;
  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      elevation: 3,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Hero(
              tag: 'contact-${contact.id}',
              child: CircleAvatar(
                radius: 28,
                backgroundImage:
                    contact.avatarUrl != null ? NetworkImage(contact.avatarUrl!) : null,
                child: contact.avatarUrl == null
                    ? Text(contact.name.isNotEmpty ? contact.name[0] : '?')
                    : null,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    contact.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    contact.phone,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: colors.onSurfaceVariant),
                  ),
                  if (contact.lastInteraction != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Dernière interaction: ${MaterialLocalizations.of(context).formatShortDate(contact.lastInteraction!)}',
                      style: Theme.of(context)
                          .textTheme
                          .labelSmall
                          ?.copyWith(color: colors.onSurfaceVariant),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            contact.hasAccount
                ? FilledButton.icon(
                    onPressed: onMessage,
                    icon: const Icon(Icons.lock_outline_rounded),
                    label: const Text('Contacter'),
                  )
                : OutlinedButton.icon(
                    onPressed: isPendingInvite ? null : onInvite,
                    icon: isPendingInvite
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded),
                    label: Text(isPendingInvite ? 'Envoi…' : 'Inviter'),
                  ),
          ],
        ),
      ),
    );
  }
}

class _ContactsLoading extends StatelessWidget {
  const _ContactsLoading();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(24),
      itemBuilder: (_, __) => const _ShimmerTile(),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemCount: 6,
    );
  }
}

class _EmptyContacts extends StatelessWidget {
  const _EmptyContacts();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.people_alt_rounded, size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              'Ajoutez vos contacts',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Invitez vos proches pour échanger en toute sécurité sur Gazavba.',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ShimmerTile extends StatefulWidget {
  const _ShimmerTile();

  @override
  State<_ShimmerTile> createState() => _ShimmerTileState();
}

class _ShimmerTileState extends State<_ShimmerTile>
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
          height: 92,
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

class _AddContactSheet extends StatefulWidget {
  const _AddContactSheet({required this.onSubmit});

  final Future<void> Function(Contact contact) onSubmit;

  @override
  State<_AddContactSheet> createState() => _AddContactSheetState();
}

class _AddContactSheetState extends State<_AddContactSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        top: 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.person_add_alt_1_rounded,
                    color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 12),
                Text(
                  'Nouveau contact',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Nom et prénom'),
              validator: (value) =>
                  value == null || value.trim().isEmpty ? 'Nom requis' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneController,
              decoration: const InputDecoration(labelText: 'Numéro de téléphone'),
              keyboardType: TextInputType.phone,
              validator: (value) =>
                  value == null || value.trim().isEmpty ? 'Téléphone requis' : null,
            ),
            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: _isSubmitting ? null : _submit,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_rounded),
                label: Text(_isSubmitting ? 'Ajout…' : 'Enregistrer'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _isSubmitting = true);
    final contact = Contact(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: _nameController.text.trim(),
      phone: _phoneController.text.trim(),
      hasAccount: false,
    );
    await widget.onSubmit(contact);
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    Navigator.of(context).maybePop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${contact.name} ajouté à vos contacts.')),
    );
  }
}

class _MessageSheet extends StatefulWidget {
  const _MessageSheet({required this.contact, required this.ref});

  final Contact contact;
  final WidgetRef ref;

  @override
  State<_MessageSheet> createState() => _MessageSheetState();
}

class _MessageSheetState extends State<_MessageSheet> {
  final _controller = TextEditingController();
  bool _isSending = false;

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
              CircleAvatar(
                backgroundColor: colors.primaryContainer,
                child: Text(widget.contact.name.isNotEmpty
                    ? widget.contact.name[0].toUpperCase()
                    : '?'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  widget.contact.name,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Écrivez un premier message…',
            ),
            onChanged: (value) {
              widget.ref
                  .read(chatControllerProvider.notifier)
                  .notifyTyping(widget.contact.id, value.trim().isNotEmpty);
            },
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: _isSending ? null : _send,
              icon: _isSending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.lock_rounded),
              label: Text(_isSending ? 'Envoi…' : 'Envoyer'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    if (_controller.text.trim().isEmpty) {
      return;
    }
    setState(() => _isSending = true);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    setState(() => _isSending = false);
    Navigator.of(context).maybePop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Message prêt à être envoyé à ${widget.contact.name}. Rendez-vous dans vos discussions !',
        ),
        action: SnackBarAction(
          label: 'Ouvrir',
          onPressed: () {
            context.go('/home/chats');
          },
        ),
      ),
    );
  }
}
