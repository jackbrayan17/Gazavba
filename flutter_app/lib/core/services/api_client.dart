import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../storage/secure_storage.dart';
import '../utils/exceptions.dart';

final databaseProvider = Provider<AppDatabase>((ref) {
  throw UnimplementedError('Database must be initialised before use');
});

final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('ApiClient must be provided before use');
});

final socketBaseUrlProvider = Provider<String>((ref) {
  return ref.watch(apiClientProvider).socketBaseUrl;
});

class ApiClient {
  ApiClient({required AppSecureStorage storage, required AppDatabase database})
      : _storage = storage,
        _database = database;

  final AppSecureStorage _storage;
  final AppDatabase _database;

  String? _token;

  String get socketBaseUrl => 'local';
  String get baseUrl => 'local';

  Future<void> init() async {
    await _database.init();
    _token = await _storage.readToken();
  }

  Future<void> setToken(String? token) async {
    if (token == null) {
      await clearToken();
      return;
    }
    _token = token;
    await _storage.writeToken(token);
  }

  Future<void> clearToken() async {
    final current = _token;
    _token = null;
    await _storage.deleteToken();
    if (current != null) {
      await _database.logout(current);
    }
  }

  Future<String?> currentToken() async {
    if (_token != null) {
      return _token;
    }
    _token = await _storage.readToken();
    return _token;
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
    bool auth = true,
  }) {
    return request(
      path,
      method: 'GET',
      data: query,
      auth: auth,
    );
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
  }) {
    return request(
      path,
      method: 'POST',
      data: data,
      auth: auth,
    );
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
  }) {
    return request(
      path,
      method: 'PUT',
      data: data,
      auth: auth,
    );
  }

  Future<Map<String, dynamic>> request(
    String path, {
    required String method,
    Map<String, dynamic>? data,
    bool auth = true,
  }) async {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final verb = method.toUpperCase();
    final payload = data ?? <String, dynamic>{};

    String? token;
    if (auth) {
      token = await _ensureToken();
    }

    switch ((verb, normalizedPath)) {
      case ('POST', '/auth/login'):
        final phone = payload['phone'] as String?;
        final password = payload['password'] as String?;
        if (phone == null || password == null) {
          throw ApiException('Téléphone ou mot de passe manquant');
        }
        final response = await _database.login(phone: phone, password: password);
        await setToken(response['token'] as String);
        return response;
      case ('POST', '/auth/register'):
        final phone = payload['phone'] as String?;
        final password = payload['password'] as String?;
        if (phone == null || password == null) {
          throw ApiException('Téléphone ou mot de passe manquant');
        }
        final avatar = _extractAvatar(payload['avatar']);
        final response = await _database.register(
          phone: phone,
          password: password,
          name: payload['name'] as String?,
          email: payload['email'] as String?,
          avatar: avatar,
        );
        await setToken(response['token'] as String);
        return response;
      case ('POST', '/auth/logout'):
        if (token != null) {
          await _database.logout(token);
        }
        return {'success': true};
      case ('GET', '/users/profile'):
        if (token == null) {
          throw ApiException('Session expirée', statusCode: 401);
        }
        final profile = await _database.refreshProfile(token);
        return profile;
      case ('PUT', '/users/profile'):
        if (token == null) {
          throw ApiException('Session expirée', statusCode: 401);
        }
        await _database.updateProfile(token, payload);
        final profile = await _database.refreshProfile(token);
        return profile;
      case ('POST', '/users/online'):
        if (token == null) {
          throw ApiException('Session expirée', statusCode: 401);
        }
        final isOnline = payload['isOnline'] != false;
        await _database.setOnlineStatus(token, isOnline);
        return {'success': true};
      case ('GET', '/chats'):
        if (token == null) {
          throw ApiException('Session expirée', statusCode: 401);
        }
        final chats = await _database.chatsForToken(token);
        return {'chats': chats};
    }

    final messagesMatch = _chatMessagesRegExp.firstMatch(normalizedPath);
    if (messagesMatch != null) {
      final chatId = int.tryParse(messagesMatch.group(1)!);
      if (chatId == null) {
        throw ApiException('Identifiant de chat invalide');
      }
      if (verb == 'GET') {
        if (token == null) {
          throw ApiException('Session expirée', statusCode: 401);
        }
        final messages =
            await _database.messagesForChat(token: token, chatId: chatId);
        return {'messages': messages};
      }
      if (verb == 'POST') {
        if (token == null) {
          throw ApiException('Session expirée', statusCode: 401);
        }
        final content = (payload['content'] as String?)?.trim();
        if (content == null || content.isEmpty) {
          throw ApiException('Message vide');
        }
        final message = await _database.createMessage(
          token: token,
          chatId: chatId,
          content: content,
        );
        return {'message': message};
      }
    }

    final muteMatch = _chatMuteRegExp.firstMatch(normalizedPath);
    if (muteMatch != null) {
      final chatId = int.tryParse(muteMatch.group(1)!);
      if (chatId == null) {
        throw ApiException('Identifiant de chat invalide');
      }
      if (token == null) {
        throw ApiException('Session expirée', statusCode: 401);
      }
      await _database.muteChat(token: token, chatId: chatId);
      return {'success': true};
    }

    throw ApiException('Endpoint $verb $normalizedPath non pris en charge');
  }

  Future<String> _ensureToken() async {
    final token = await currentToken();
    if (token == null) {
      throw ApiException('Session expirée, veuillez vous reconnecter',
          statusCode: 401);
    }
    return token;
  }

  Uint8List? _extractAvatar(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is Uint8List) {
      return value;
    }
    if (value is List<int>) {
      return Uint8List.fromList(value);
    }
    return null;
  }

  static final _chatMessagesRegExp = RegExp(r'^/chats/(.+?)/messages$');
  static final _chatMuteRegExp = RegExp(r'^/chats/(.+?)/mute$');
}
