import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Wrapper autour de Supabase pour centraliser l'initialisation et les appels
/// courants (inscription, profils, OTP SMS, etc.).
class SupabaseService {
  SupabaseService._();

  static final SupabaseService instance = SupabaseService._();

  /// Valeurs par défaut pouvant être remplacées via `--dart-define` au build
  /// ou en appelant [configure] avant [init].
  static String supabaseUrl = const String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'YOUR_SUPABASE_URL',
  );

  static String supabaseAnonKey = const String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'YOUR_SUPABASE_ANON_KEY',
  );

  bool _initialised = false;

  bool get isConfigured =>
      supabaseUrl.isNotEmpty &&
      supabaseAnonKey.isNotEmpty &&
      supabaseUrl != 'YOUR_SUPABASE_URL' &&
      supabaseAnonKey != 'YOUR_SUPABASE_ANON_KEY';

  /// Permet de surcharger les identifiants Supabase programmatiquement avant
  /// l'initialisation.
  void configure({required String url, required String anonKey}) {
    if (_initialised) {
      throw StateError(
        'SupabaseService déjà initialisé. Configurez-le avant init().',
      );
    }
    supabaseUrl = url;
    supabaseAnonKey = anonKey;
  }

  Future<void> init() async {
    if (!isConfigured || _initialised) {
      return;
    }
    await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
    _initialised = true;
  }

  Future<void> ensureInitialized() async {
    if (!isConfigured) {
      throw StateError(
        'Supabase non configuré. Définissez supabaseUrl et supabaseAnonKey.',
      );
    }
    if (_initialised) {
      return;
    }
    try {
      await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
      _initialised = true;
    } on AssertionError {
      // Probablement déjà initialisé ailleurs; on continue.
      _initialised = true;
    }
  }

  /// Inscription email + mot de passe + upload avatar + upsert profil.
  Future<void> signUpUser(
    Map<String, dynamic> data, {
    Uint8List? avatarBytes,
    String? avatarFileExtension,
  }) async {
    await ensureInitialized();
    final client = Supabase.instance.client;
    final email = (data['email'] as String?)?.trim();
    final password = data['password'] as String?;
    if (email == null || email.isEmpty || password == null || password.isEmpty) {
      throw ArgumentError('E-mail et mot de passe requis.');
    }

    final userMeta = Map<String, dynamic>.from(data)
      ..remove('email')
      ..remove('password')
      ..removeWhere((key, value) => value == null);

    final signUpResponse = await client.auth.signUp(
      email: email,
      password: password,
      data: userMeta,
    );
    final user = signUpResponse.user;
    if (user == null) {
      throw StateError(
        'Utilisateur créé, en attente de confirmation e-mail.',
      );
    }

    String? avatarUrl;
    if (avatarBytes != null && avatarBytes.isNotEmpty) {
      final sanitizedExt = _sanitizeExtension(avatarFileExtension);
      final filePath = 'avatars/${user.id}.$sanitizedExt';
      await client.storage.from('profiles').uploadBinary(
            filePath,
            avatarBytes,
            fileOptions: const FileOptions(upsert: true),
          );
      avatarUrl = client.storage.from('profiles').getPublicUrl(filePath);
    }

    final profileRow = <String, dynamic>{
      'id': user.id,
      'email': email,
      ...userMeta,
      if (avatarUrl != null) 'avatar_url': avatarUrl,
    }..removeWhere((_, value) => value == null);

    await client.from('profiles').upsert(profileRow);
  }

  /// Envoie un OTP par SMS pour le numéro [phone].
  Future<void> sendOtpToPhone(
    String phone, {
    bool shouldCreateUser = false,
  }) async {
    await ensureInitialized();
    final client = Supabase.instance.client;
    await client.auth.signInWithOtp(
      phone: phone,
      shouldCreateUser: shouldCreateUser,
      channel: OtpChannel.sms,
    );
  }

  /// Vérifie le code OTP reçu par SMS pour le numéro [phone].
  Future<void> verifyOtpForPhone(String phone, String token) async {
    await ensureInitialized();
    final client = Supabase.instance.client;
    await client.auth.verifyOTP(
      phone: phone,
      token: token,
      type: OtpType.sms,
    );
  }

  String _sanitizeExtension(String? extension) {
    final normalized = extension?.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (normalized == null || normalized.isEmpty) {
      return 'png';
    }
    return normalized;
  }
}

final supabaseServiceProvider = Provider<SupabaseService>((ref) {
  final service = SupabaseService.instance;
  // On tente une initialisation silencieuse pour éviter les erreurs tardives.
  unawaited(service.init());
  return service;
});
