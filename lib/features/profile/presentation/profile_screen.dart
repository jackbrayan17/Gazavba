import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/controllers/auth_controller.dart';
import '../../../core/services/log_service.dart';
import '../../../core/theme/theme_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final themeMode = ref.watch(themeControllerProvider);
    final logService = ref.watch(logServiceProvider);

    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profil')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Vous devez être connecté pour voir votre profil'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.go('/auth/login'),
                child: const Text('Se connecter'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon profil'),
        actions: [
          IconButton(
            tooltip: 'Actualiser',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(authControllerProvider.notifier).refreshProfile(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Center(
            child: CircleAvatar(
              radius: 48,
              backgroundImage: user.avatarUrl != null ? NetworkImage(user.avatarUrl!) : null,
              child: user.avatarUrl == null
                  ? Text(
                      user.name.isNotEmpty ? user.name.characters.first.toUpperCase() : '?',
                      style: Theme.of(context).textTheme.headlineMedium,
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              user.name,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              user.phone,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(height: 32),
          _AppearanceCard(
            themeMode: themeMode,
            onChanged: (mode) =>
                ref.read(themeControllerProvider.notifier).setTheme(mode),
            logFilePath: logService.logFilePath,
          ),
          const SizedBox(height: 16),
          _InfoTile(
            icon: Icons.lock_outline_rounded,
            title: 'Sécurité avancée',
            subtitle: 'Vos messages sont chiffrés de bout en bout via gazavba.eeuez.com',
          ),
          _InfoTile(
            icon: Icons.devices_rounded,
            title: 'Appareils connectés',
            subtitle: 'Une seule session active est autorisée par compte pour limiter les risques',
          ),
          _InfoTile(
            icon: Icons.storage_rounded,
            title: 'Stockage',
            subtitle: 'Pièces jointes et médias sont hébergés de manière sécurisée sur l’API Gazavba',
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: authState.isLoading
                ? null
                : () async {
                    await ref.read(authControllerProvider.notifier).logout();
                    if (context.mounted) {
                      context.go('/auth/login');
                    }
                  },
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
  }
}

class _AppearanceCard extends StatelessWidget {
  const _AppearanceCard({
    required this.themeMode,
    required this.onChanged,
    this.logFilePath,
  });

  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onChanged;
  final String? logFilePath;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final selection = <ThemeMode>{themeMode};

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.palette_rounded, color: colors.primary),
                const SizedBox(width: 12),
                Text(
                  'Apparence et suivi',
                  style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(
                  value: ThemeMode.system,
                  icon: Icon(Icons.brightness_auto_rounded),
                  label: Text('Auto'),
                ),
                ButtonSegment(
                  value: ThemeMode.light,
                  icon: Icon(Icons.wb_sunny_rounded),
                  label: Text('Clair'),
                ),
                ButtonSegment(
                  value: ThemeMode.dark,
                  icon: Icon(Icons.nights_stay_rounded),
                  label: Text('Sombre'),
                ),
              ],
              selected: selection,
              showSelectedIcon: false,
              onSelectionChanged: (selected) {
                if (selected.isEmpty) {
                  return;
                }
                onChanged(selected.first);
              },
            ),
            const SizedBox(height: 20),
            Text(
              'Journal en temps réel',
              style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              logFilePath != null
                  ? 'Chaque action est enregistrée dans le fichier:\n$logFilePath'
                  : 'Le suivi s’affiche dans la console de développement.',
              style: textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListTile(
        leading: CircleAvatar(
          radius: 24,
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          child: Icon(icon, color: Theme.of(context).colorScheme.primary),
        ),
        title: Text(title),
        subtitle: Text(subtitle),
      ),
    );
  }
}
