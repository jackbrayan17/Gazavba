import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../chat/controllers/chat_controller.dart';

class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatState = ref.watch(chatControllerProvider);
    final statuses = chatState.chats.take(6).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Statuts'),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: statuses.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _AddStatusCard();
          }
          final chat = statuses[index - 1];
          return Card(
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              leading: CircleAvatar(
                radius: 28,
                backgroundImage: chat.avatarUrl != null ? NetworkImage(chat.avatarUrl!) : null,
                child: chat.avatarUrl == null
                    ? Text(chat.title.characters.first.toUpperCase())
                    : null,
              ),
              title: Text(chat.title),
              subtitle: const Text('A partagé un statut sécurisé'),
              trailing: const Icon(Icons.lock_outline_rounded),
            ),
          );
        },
      ),
    );
  }
}

class _AddStatusCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        leading: CircleAvatar(
          radius: 28,
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          child: Icon(
            Icons.add_a_photo_outlined,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        title: const Text('Ajouter à mon statut'),
        subtitle: const Text('Partagez un moment avec vos contacts Gazavba'),
        trailing: FilledButton.tonal(
          onPressed: () {},
          child: const Text('Bientôt'),
        ),
      ),
    );
  }
}
