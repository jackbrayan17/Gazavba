import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
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
  static const _themeModeKey = 'theme_mode';

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

  Future<void> writeThemeMode(ThemeMode mode) async {
    await _prefs.setString(_themeModeKey, mode.name);
  }

  Future<ThemeMode?> readThemeMode() async {
    final value = _prefs.getString(_themeModeKey);
    if (value == null) return null;
    return ThemeMode.values.firstWhere(
      (mode) => mode.name == value,
      orElse: () => ThemeMode.system,
    );
  }

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
