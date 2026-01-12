import 'package:flutter/material.dart';

class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
      ),
      body: ListView(
        children: [
          _SectionHeader(title: 'Messages'),
          SwitchListTile(
            value: true,
            onChanged: (val) {},
            title: const Text('Sons de la conversation'),
            subtitle: const Text(
                'Jouer des sons pour les messages entrants et sortants'),
          ),
          ListTile(
            title: const Text('Son de notification'),
            subtitle: const Text('Par défaut (Note)'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('Vibreur'),
            subtitle: const Text('Par défaut'),
            onTap: () {},
          ),
          const Divider(),
          _SectionHeader(title: 'Groupes'),
          ListTile(
            title: const Text('Son de notification'),
            subtitle: const Text('Par défaut (Note)'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('Vibreur'),
            subtitle: const Text('Par défaut'),
            onTap: () {},
          ),
          const Divider(),
          _SectionHeader(title: 'Appels'),
          ListTile(
            title: const Text('Sonnerie'),
            subtitle: const Text('Par défaut (Ring)'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('Vibreur'),
            subtitle: const Text('Par défaut'),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }
}
