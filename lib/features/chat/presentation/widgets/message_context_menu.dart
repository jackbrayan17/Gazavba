import 'package:flutter/material.dart';
import '../../../../core/models/message.dart';

class MessageContextMenu extends StatelessWidget {
  const MessageContextMenu({super.key, required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.star_border_rounded),
            title: const Text('Important'),
            onTap: () {
              // TODO: Star message
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading: const Icon(Icons.reply_rounded),
            title: const Text('Répondre'),
            onTap: () {
              // TODO: Reply
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading: const Icon(Icons.forward_rounded),
            title: const Text('Transférer'),
            onTap: () {
              // TODO: Forward
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading: const Icon(Icons.copy_rounded),
            title: const Text('Copier'),
            onTap: () {
              // TODO: Copy text
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading: const Icon(Icons.info_outline_rounded),
            title: const Text('Infos'),
            onTap: () {
              // TODO: Message info
              Navigator.pop(context);
            },
          ),
          ListTile(
            leading:
                const Icon(Icons.delete_outline_rounded, color: Colors.red),
            title: const Text('Supprimer', style: TextStyle(color: Colors.red)),
            onTap: () {
              // TODO: Delete message
              Navigator.pop(context);
            },
          ),
        ],
      ),
    );
  }
}
