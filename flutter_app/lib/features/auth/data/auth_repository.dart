import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:logging/logging.dart';

import '../../../core/models/user.dart';
import '../../../core/services/api_client.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/utils/exceptions.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  final supabase = ref.watch(supabaseServiceProvider);
  return AuthRepository(client, supabase);
});

class AuthRepository {
  AuthRepository(this._client, this._supabaseService);

  final ApiClient _client;
  final SupabaseService _supabaseService;

  Future<User> login({required String phone, required String password}) async {
    final payload = await _client.post(
      '/auth/login',
      data: {'phone': phone, 'password': password},
      auth: false,
    );
    final token = payload['token'] as String?;
    if (token == null) {
      throw ApiException('Token manquant dans la réponse');
    }
    await _client.setToken(token);
    final profile = payload['user'] as Map<String, dynamic>? ??
        await _client.get('/users/profile', auth: true);
    return User.fromJson(profile);
  }

  Future<User> register({
    required String phone,
    required String password,
    String? name,
    String? email,
    Uint8List? avatarBytes,
    String? avatarFileExtension,
  }) async {
    final payload = await _client.post(
      '/auth/register',
      data: {
        'phone': phone,
        'password': password,
        if (name != null) 'name': name,
        if (email != null) 'email': email,
        if (avatarBytes != null) 'avatar': avatarBytes,
      },
      auth: false,
    );
    final token = payload['token'] as String?;
    if (token != null) {
      await _client.setToken(token);
    }
    final profile = payload['user'] as Map<String, dynamic>? ??
        await _client.get('/users/profile', auth: true);
    final user = User.fromJson(profile);

    if (email != null && email.isNotEmpty && _supabaseService.isConfigured) {
      final parsedName = _splitName(name);
      final supabaseData = <String, dynamic>{
        'email': email,
        'password': password,
        'phone': phone,
        if (parsedName.$1 != null) 'first_name': parsedName.$1,
        if (parsedName.$2 != null) 'last_name': parsedName.$2,
      };
      try {
        await _supabaseService.signUpUser(
          supabaseData,
          avatarBytes: avatarBytes,
          avatarFileExtension: avatarFileExtension,
        );
      } catch (error, stackTrace) {
        _logger.warning(
          'Echec de synchronisation de l\'inscription avec Supabase',
          error,
          stackTrace,
        );
      }
    }

    return user;
  }

  Future<User> refreshProfile() async {
    final profile = await _client.get('/users/profile', auth: true);
    return User.fromJson(profile);
  }

  Future<void> updateProfile({
    String? name,
    String? email,
    String? phone,
  }) async {
    await _client.put('/users/profile', data: {
      if (name != null) 'name': name,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
    });
  }

  Future<void> logout() async {
    try {
      await _client.post('/auth/logout', auth: true);
    } catch (_) {
      // logout should never throw if network fails
    }
    await _client.clearToken();
  }
}

typedef _NameParts = (String?, String?);

_NameParts _splitName(String? name) {
  if (name == null || name.trim().isEmpty) {
    return (null, null);
  }
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.length == 1) {
    return (parts.first, null);
  }
  final firstName = parts.first;
  final lastName = parts.sublist(1).join(' ').trim();
  return (firstName, lastName.isEmpty ? null : lastName);
}

final _logger = Logger('AuthRepository');
