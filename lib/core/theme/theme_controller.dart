import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../storage/secure_storage.dart';

final themeControllerProvider =
    StateNotifierProvider<ThemeController, ThemeMode>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ThemeController(storage: storage);
});

class ThemeController extends StateNotifier<ThemeMode> {
  ThemeController({required AppSecureStorage storage})
      : _storage = storage,
        super(ThemeMode.system) {
    _loadInitialTheme();
  }

  final AppSecureStorage _storage;
  final Logger _logger = Logger('ThemeController');

  Future<void> _loadInitialTheme() async {
    final stored = await _storage.readThemeMode();
    if (stored != null) {
      state = stored;
    }
    _logger.info('Initial theme mode -> ${state.name}');
  }

  Future<void> toggle() async {
    final next = state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    await setTheme(next);
  }

  Future<void> setTheme(ThemeMode mode) async {
    state = mode;
    await _storage.writeThemeMode(mode);
    _logger.info('Theme mode changed -> ${mode.name}');
  }
}
