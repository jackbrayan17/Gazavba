import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

final secureStorageProvider = Provider<AppSecureStorage>((ref) {
  throw UnimplementedError('Secure storage has not been initialised');
});

class AppSecureStorage {
  AppSecureStorage._(this._secureStorage, this._prefs);

  final FlutterSecureStorage? _secureStorage;
  final SharedPreferences _prefs;

  static const _tokenKey = 'access_token';

  static Future<AppSecureStorage> create() async {
    FlutterSecureStorage? secure;
    if (!kIsWeb) {
      secure = const FlutterSecureStorage(
        iOptions: IOSOptions(accessibility: KeychainAccessibility.unlocked),
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
      );
    }
    final prefs = await SharedPreferences.getInstance();
    return AppSecureStorage._(secure, prefs);
  }

  Future<void> writeToken(String? token) async {
    if (token == null) {
      await deleteToken();
      return;
    }
    await _write(_tokenKey, token);
  }

  Future<String?> readToken() => _read(_tokenKey);

  Future<void> deleteToken() => _delete(_tokenKey);

  Future<void> _write(String key, String value) async {
    if (_secureStorage != null) {
      await _secureStorage!.write(key: key, value: value);
    }
    await _prefs.setString(key, value);
  }

  Future<String?> _read(String key) async {
    if (_secureStorage != null) {
      final value = await _secureStorage!.read(key: key);
      if (value != null) {
        return value;
      }
    }
    return _prefs.getString(key);
  }

  Future<void> _delete(String key) async {
    if (_secureStorage != null) {
      await _secureStorage!.delete(key: key);
    }
    await _prefs.remove(key);
  }
}
