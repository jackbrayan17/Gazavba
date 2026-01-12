import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../../../core/models/user.dart';
import '../../../core/services/api_client.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../data/auth_repository.dart';

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  final client = ref.watch(apiClientProvider);
  return AuthController(repository: repository, apiClient: client)
    ..initialise();
});

class AuthState {
  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
    this.bootstrapComplete = false,
  });

  final User? user;
  final bool isLoading;
  final String? error;
  final bool bootstrapComplete;

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
    bool? bootstrapComplete,
    bool clearError = false,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      bootstrapComplete: bootstrapComplete ?? this.bootstrapComplete,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController({required this.repository, required this.apiClient})
      : _logger = Logger('AuthController'),
        super(const AuthState());

  final AuthRepository repository;
  final ApiClient apiClient;
  Timer? _statusTimer;
  bool _presenceUpdating = false;
  final Logger _logger;

  Future<void> initialise() async {
    final token = await apiClient.currentToken();
    if (token == null) {
      state = state.copyWith(bootstrapComplete: true);
      return;
    }
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.refreshProfile();
      if ((user.id).isEmpty) {
        _logger.warning('Refreshed profile has empty id during initialise');
      }
      state =
          state.copyWith(user: user, isLoading: false, bootstrapComplete: true);
      _startPresenceLoop();
      _logger.info('Session restauree pour ${user.id}');
    } catch (error) {
      await apiClient.clearToken();
      state = state.copyWith(
        isLoading: false,
        error: error.toString(),
        user: null,
        bootstrapComplete: true,
      );
      _logger.warning('Impossible de restaurer la session: $error');
    }
  }

  Future<Result<User>> login(String phone, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.login(phone: phone, password: password);
      final refreshed = await repository.refreshProfile();
      if ((refreshed.id).isEmpty) {
        _logger.warning('Refreshed profile has empty id after login');
      }
      state = state.copyWith(
          user: refreshed, isLoading: false, bootstrapComplete: true);
      _startPresenceLoop();
      _logger.info(
        'Utilisateur connecté ${refreshed.id} (bio present=${(refreshed.bio ?? '').isNotEmpty})',
      );
      return Success(user);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning('Echec de connexion: ${error.message}');
      return Failure(error);
    }
  }

  Future<Result<User>> register({
    required String phone,
    required String password,
    String? name,
    String? email,
    MultipartFile? avatar,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.register(
        phone: phone,
        password: password,
        name: name,
        email: email,
        avatar: avatar,
      );
      final refreshed = await repository.refreshProfile();
      if ((refreshed.id).isEmpty) {
        _logger.warning('Refreshed profile has empty id after register');
      }
      state = state.copyWith(
          user: refreshed, isLoading: false, bootstrapComplete: true);
      _startPresenceLoop();
      _logger.info(
        'Nouveau compte cree ${refreshed.id} (bio present=${(refreshed.bio ?? '').isNotEmpty})',
      );
      return Success(user);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning("Echec d'inscription: ${error.message}");
      return Failure(error);
    }
  }

  Future<Result<User>> updateProfile({
    String? name,
    String? email,
    String? phone,
    MultipartFile? avatar,
    String? bio,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.updateProfile(
        name: name,
        email: email,
        phone: phone,
        avatar: avatar,
        bio: bio,
      );
      state = state.copyWith(user: user, isLoading: false);
      _logger.info('Profil mis a jour pour ${user.id}');
      return Success(user);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning('Mise a jour du profil impossible: ${error.message}');
      return Failure(error);
    }
  }

  Future<void> refreshProfile() async {
    try {
      final user = await repository.refreshProfile();
      state = state.copyWith(user: user);
      if ((user.id).isEmpty) {
        _logger.warning('refreshProfile returned empty id');
      }
    } catch (_) {
      // ignore
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await repository.logout();
    await apiClient.clearToken();
    state = const AuthState(bootstrapComplete: true);
    _statusTimer?.cancel();
    _logger.info('Utilisateur deconnecte');
  }

  void _startPresenceLoop() {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(const Duration(seconds: 1), (_) async {
      if (_presenceUpdating) return;
      _presenceUpdating = true;
      try {
        await apiClient.post('/users/online', data: {'isOnline': true});
        _logger.fine('Presence synchronisee');
      } catch (_) {
        // ignore presence errors
      } finally {
        _presenceUpdating = false;
      }
    });
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }
}
