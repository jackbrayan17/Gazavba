import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:go_router/go_router.dart';
import '../../auth/controllers/auth_controller.dart';
import 'settings/notification_settings_screen.dart';
import 'settings/storage_settings_screen.dart';
import 'settings/chat_settings_screen.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Paramètres'),
      ),
      body: ListView(
        children: [
          // Profile Header
          ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: Hero(
              tag: 'profile_avatar',
              child: CircleAvatar(
                radius: 30,
                backgroundImage: user?.avatarUrl != null
                    ? NetworkImage(user!.avatarUrl!)
                    : null,
                child: user?.avatarUrl == null
                    ? const Icon(Icons.person, size: 32)
                    : null,
              ),
            ),
            title: Text(
              user?.name ?? 'Utilisateur',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w500),
            ),
            subtitle: const Text('Hey there! I am using Gazavba.'),
            onTap: () {
              // TODO: Edit profile
            },
          ),
          const Divider(),

          // Account
          _SettingsTile(
            icon: Icons.key_rounded,
            title: 'Compte',
            subtitle: 'Notifications de sécurité, changer de numéro',
            onTap: () {},
          ),

          // Privacy
          _SettingsTile(
            icon: Icons.lock_outline_rounded,
            title: 'Confidentialité',
            subtitle: 'Bloquer des contacts, messages éphémères',
            onTap: () {},
          ),

          // Avatar
          _SettingsTile(
            icon: Icons.face_rounded,
            title: 'Avatar',
            subtitle: 'Créer, modifier, photo de profil',
            onTap: () {},
          ),

          // Chats
          _SettingsTile(
            icon: Icons.chat_bubble_outline_rounded,
            title: 'Discussions',
            subtitle: 'Thème, fonds d\'écran, historique',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ChatSettingsScreen()),
            ),
          ),

          // Notifications
          _SettingsTile(
            icon: Icons.notifications_none_rounded,
            title: 'Notifications',
            subtitle: 'Sons des messages, groupes et appels',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const NotificationSettingsScreen()),
            ),
          ),

          // Storage
          _SettingsTile(
            icon: Icons.data_usage_rounded,
            title: 'Utilisation données et stockage',
            subtitle: 'Utilisation réseau, téléchargement auto',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const StorageSettingsScreen()),
            ),
          ),

          // Language
          _SettingsTile(
            icon: Icons.language_rounded,
            title: 'Langue de l\'application',
            subtitle: 'Français (téléphone)',
            onTap: () {},
          ),

          // Help
          _SettingsTile(
            icon: Icons.help_outline_rounded,
            title: 'Aide',
            subtitle: 'Centre d\'aide, nous contacter, politique',
            onTap: () {},
          ),

          // Invite
          _SettingsTile(
            icon: Icons.group_add_outlined,
            title: 'Inviter des amis',
            onTap: () {},
          ),

          const SizedBox(height: 32),

          // Logout
          Center(
            child: TextButton(
              onPressed: () {
                ref.read(authControllerProvider.notifier).logout();
                context.go('/login');
              },
              child: const Text(
                'Se déconnecter',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text(
              'from\nGazavba',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: Colors.grey[600]),
      title: Text(title),
      subtitle: subtitle != null ? Text(subtitle!) : null,
      onTap: onTap,
    );
  }
}
