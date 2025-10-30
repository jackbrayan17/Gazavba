import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/user.dart';
import '../../../core/services/api_client.dart';
import '../../../core/utils/exceptions.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return AuthRepository(client);
});

class AuthRepository {
  AuthRepository(this._client);

  final ApiClient _client;

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
    MultipartFile? avatar,
  }) async {
    final formData = FormData.fromMap({
      'phone': phone,
      'password': password,
      if (name != null) 'name': name,
      if (email != null) 'email': email,
      if (avatar != null) 'avatar': avatar,
    });
    final payload = await _client.post(
      '/auth/register',
      formData: formData,
      auth: false,
    );
    final token = payload['token'] as String?;
    if (token != null) {
      await _client.setToken(token);
    }
    final profile = payload['user'] as Map<String, dynamic>? ??
        await _client.get('/users/profile', auth: true);
    return User.fromJson(profile);
  }

  Future<User> refreshProfile() async {
    final profile = await _client.get('/users/profile', auth: true);
    return User.fromJson(profile);
  }

  Future<User> updateProfile({
    String? name,
    String? email,
    String? phone,
    MultipartFile? avatar,
  }) async {
    final payload = <String, dynamic>{
      if (name != null) 'name': name,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
    };
    final hasAvatar = avatar != null;
    final response = await _client.put(
      '/users/profile',
      data: hasAvatar ? null : payload,
      formData: hasAvatar ? FormData.fromMap({...payload, 'avatar': avatar}) : null,
    );
    final profile = response['user'] as Map<String, dynamic>? ??
        response['data'] as Map<String, dynamic>? ??
        response;
    return User.fromJson(profile);
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
