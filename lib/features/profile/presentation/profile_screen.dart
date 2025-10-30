import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../auth/controllers/auth_controller.dart';
import '../../../core/services/log_service.dart';
import '../../../core/theme/theme_controller.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../../../core/models/user.dart';

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
            child: Stack(
              alignment: Alignment.bottomRight,
              children: [
                CircleAvatar(
                  radius: 54,
                  backgroundImage:
                      user.avatarUrl != null ? NetworkImage(user.avatarUrl!) : null,
                  child: user.avatarUrl == null
                      ? Text(
                          user.name.isNotEmpty
                              ? user.name.characters.first.toUpperCase()
                              : '?',
                          style: Theme.of(context).textTheme.headlineMedium,
                        )
                      : null,
                ),
                FilledButton.tonalIcon(
                  icon: const Icon(Icons.camera_alt_rounded, size: 18),
                  label: const Text('Modifier'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    textStyle: Theme.of(context).textTheme.labelSmall,
                    visualDensity: VisualDensity.compact,
                  ),
                  onPressed: () => _openEditSheet(context, ref, user),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: Column(
              children: [
                Text(
                  user.name,
                  style:
                      Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  user.phone,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (user.email?.isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    user.email!,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ],
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: () => _openEditSheet(context, ref, user),
                  icon: const Icon(Icons.edit_rounded),
                  label: const Text('Mettre à jour mon profil'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.person_outline_rounded),
                  title: const Text('Nom complet'),
                  subtitle: Text(user.name.isEmpty ? 'Non renseigné' : user.name),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit_note_rounded),
                    onPressed: () => _openEditSheet(context, ref, user, focusField: _ProfileField.name),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.mail_outline_rounded),
                  title: const Text('Adresse e-mail'),
                  subtitle: Text(user.email?.isNotEmpty == true ? user.email! : 'Non renseignée'),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit_note_rounded),
                    onPressed: () =>
                        _openEditSheet(context, ref, user, focusField: _ProfileField.email),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.phone_android_rounded),
                  title: const Text('Téléphone'),
                  subtitle: Text(user.phone.isEmpty ? 'Non renseigné' : user.phone),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit_note_rounded),
                    onPressed: () =>
                        _openEditSheet(context, ref, user, focusField: _ProfileField.phone),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
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

void _openEditSheet(
  BuildContext context,
  WidgetRef ref,
  User user, {
  _ProfileField? focusField,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    builder: (context) => _ProfileEditSheet(user: user, focusField: focusField),
  );
}

enum _ProfileField { name, email, phone }

class _ProfileEditSheet extends ConsumerStatefulWidget {
  const _ProfileEditSheet({required this.user, this.focusField});

  final User user;
  final _ProfileField? focusField;

  @override
  ConsumerState<_ProfileEditSheet> createState() => _ProfileEditSheetState();
}

class _ProfileEditSheetState extends ConsumerState<_ProfileEditSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedFile;
  Uint8List? _previewBytes;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.user.name);
    _emailController = TextEditingController(text: widget.user.email ?? '');
    _phoneController = TextEditingController(text: widget.user.phone);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      switch (widget.focusField) {
        case _ProfileField.name:
          FocusScope.of(context).requestFocus(_nameFocus);
          break;
        case _ProfileField.email:
          FocusScope.of(context).requestFocus(_emailFocus);
          break;
        case _ProfileField.phone:
          FocusScope.of(context).requestFocus(_phoneFocus);
          break;
        case null:
          break;
      }
    });
  }

  final FocusNode _nameFocus = FocusNode();
  final FocusNode _emailFocus = FocusNode();
  final FocusNode _phoneFocus = FocusNode();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _nameFocus.dispose();
    _emailFocus.dispose();
    _phoneFocus.dispose();
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
              Icon(Icons.manage_accounts_rounded, color: colors.primary),
              const SizedBox(width: 12),
              Text(
                'Modifier mon profil',
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
          Row(
            children: [
              CircleAvatar(
                radius: 34,
                backgroundImage: _previewBytes != null
                    ? MemoryImage(_previewBytes!) as ImageProvider<Object>
                    : widget.user.avatarUrl != null
                    ? NetworkImage(widget.user.avatarUrl!) as ImageProvider<Object>
                    : null,
                child: widget.user.avatarUrl == null && _previewBytes == null
                    ? Text(
                        widget.user.name.isNotEmpty
                            ? widget.user.name.characters.first.toUpperCase()
                            : '?',
                      )
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    FilledButton.tonalIcon(
                      onPressed: _isSaving ? null : _pickImage,
                      icon: const Icon(Icons.photo_library_rounded),
                      label: const Text('Choisir'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _isSaving || (_previewBytes == null && widget.user.avatarUrl == null)
                          ? null
                          : _clearImage,
                      icon: const Icon(Icons.delete_outline_rounded),
                      label: const Text('Retirer'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _nameController,
            focusNode: _nameFocus,
            decoration: const InputDecoration(labelText: 'Nom complet'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            focusNode: _emailFocus,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Adresse e-mail'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneController,
            focusNode: _phoneFocus,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Téléphone'),
          ),
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: _isSaving ? null : _submit,
              icon: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_rounded),
              label: Text(_isSaving ? 'Enregistrement…' : 'Enregistrer'),
            ),
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
    setState(() => _isSaving = true);
    MultipartFile? avatar;
    if (_selectedFile != null) {
      final bytes = await _selectedFile!.readAsBytes();
      avatar = MultipartFile.fromBytes(
        bytes,
        filename: _selectedFile!.name,
      );
    }

    final notifier = ref.read(authControllerProvider.notifier);
    final result = await notifier.updateProfile(
      name: _nameController.text.trim(),
      email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
      phone: _phoneController.text.trim(),
      avatar: avatar,
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (result is Success<User>) {
      Navigator.of(context).maybePop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil mis à jour avec succès.')),
      );
    } else if (result is Failure<User>) {
      final error = result.error;
      final message = error is ApiException ? error.message : error.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    }
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
