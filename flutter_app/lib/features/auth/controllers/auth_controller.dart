import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/user.dart';
import '../../../core/services/api_client.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../data/auth_repository.dart';

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  final client = ref.watch(apiClientProvider);
  return AuthController(repository: repository, apiClient: client)..initialise();
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
      : super(const AuthState());

  final AuthRepository repository;
  final ApiClient apiClient;
  Timer? _statusTimer;

  Future<void> initialise() async {
    final token = await apiClient.currentToken();
    if (token == null) {
      state = state.copyWith(bootstrapComplete: true);
      return;
    }
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.refreshProfile();
      state = state.copyWith(user: user, isLoading: false, bootstrapComplete: true);
    } catch (error) {
      await apiClient.clearToken();
      state = state.copyWith(isLoading: false, error: error.toString(), user: null, bootstrapComplete: true);
    }
  }

  Future<Result<User>> login(String phone, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.login(phone: phone, password: password);
      state = state.copyWith(user: user, isLoading: false, bootstrapComplete: true);
      _startPresenceLoop();
      return Success(user);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      return Failure(error);
    }
  }

  Future<Result<User>> register({
    required String phone,
    required String password,
    String? name,
    String? email,
    Uint8List? avatarBytes,
    String? avatarFileExtension,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await repository.register(
        phone: phone,
        password: password,
        name: name,
        email: email,
        avatarBytes: avatarBytes,
        avatarFileExtension: avatarFileExtension,
      );
      state = state.copyWith(user: user, isLoading: false, bootstrapComplete: true);
      _startPresenceLoop();
      return Success(user);
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error.message);
      return Failure(error);
    }
  }

  Future<void> refreshProfile() async {
    try {
      final user = await repository.refreshProfile();
      state = state.copyWith(user: user);
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
  }

  void _startPresenceLoop() {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(const Duration(minutes: 1), (_) async {
      try {
        await apiClient.post('/users/online', data: {'isOnline': true});
      } catch (_) {
        // ignore presence errors
      }
    });
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }
}
