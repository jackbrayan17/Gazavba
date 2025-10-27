import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

import '../../../core/models/status.dart';
import '../../../core/utils/exceptions.dart';
import '../../../core/utils/result.dart';
import '../../auth/controllers/auth_controller.dart';
import '../data/status_repository.dart';

final statusControllerProvider =
    StateNotifierProvider<StatusController, StatusState>((ref) {
  final repository = ref.watch(statusRepositoryProvider);
  final controller = StatusController(repository: repository);

  Future.microtask(() {
    controller.onAuthStateChanged(ref.read(authControllerProvider));
  });

  ref.listen<AuthState>(authControllerProvider, (previous, next) {
    controller.onAuthStateChanged(next);
  });

  return controller;
});

class StatusState {
  const StatusState({
    this.statuses = const [],
    this.isLoading = false,
    this.error,
    this.unseenCount = 0,
  });

  final List<Status> statuses;
  final bool isLoading;
  final String? error;
  final int unseenCount;

  StatusState copyWith({
    List<Status>? statuses,
    bool? isLoading,
    String? error,
    int? unseenCount,
    bool clearError = false,
  }) {
    return StatusState(
      statuses: statuses ?? this.statuses,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      unseenCount: unseenCount ?? this.unseenCount,
    );
  }
}

class StatusController extends StateNotifier<StatusState> {
  StatusController({required this.repository})
      : _logger = Logger('StatusController'),
        super(const StatusState());

  final StatusRepository repository;
  final Logger _logger;
  Timer? _refreshTimer;

  Future<void> onAuthStateChanged(AuthState authState) async {
    if (authState.isAuthenticated) {
      await loadStatuses();
      _startRefreshLoop();
    } else {
      _refreshTimer?.cancel();
      this.state = const StatusState();
    }
  }

  Future<void> loadStatuses() async {
    this.state = state.copyWith(isLoading: true, clearError: true);
    try {
      final statuses = await repository.fetchStatuses();
      final unseen = await repository.unseenCount();
      this.state = state.copyWith(
        statuses: statuses,
        unseenCount: unseen,
        isLoading: false,
      );
      _logger.info('Loaded ${statuses.length} statuses (unseen: $unseen)');
    } on ApiException catch (error) {
      this.state = state.copyWith(isLoading: false, error: error.message);
      _logger.warning('Failed to load statuses: ${error.message}');
    }
  }

  Future<Result<Status>> publishText(String content) async {
    try {
      final status = await repository.createTextStatus(content);
      final updated = [status, ...state.statuses];
      this.state = state.copyWith(statuses: updated);
      _logger.info('Published text status ${status.id}');
      return Success(status);
    } on ApiException catch (error) {
      _logger.warning('Unable to publish status: ${error.message}');
      return Failure(error);
    }
  }

  Future<Result<Status>> publishMedia({
    required MultipartFile file,
    String? caption,
  }) async {
    try {
      final status = await repository.createMediaStatus(file: file, content: caption);
      final updated = [status, ...state.statuses];
      this.state = state.copyWith(statuses: updated);
      _logger.info('Published media status ${status.id}');
      return Success(status);
    } on ApiException catch (error) {
      _logger.warning('Unable to publish media status: ${error.message}');
      return Failure(error);
    }
  }

  Future<void> markViewed(String statusId) async {
    try {
      await repository.markAsViewed(statusId);
      final updated = state.statuses
          .map(
            (status) => status.id == statusId
                ? status.copyWith(hasViewed: true, viewCount: status.viewCount + 1)
                : status,
          )
          .toList();
      state = state.copyWith(statuses: updated);
    } catch (error) {
      _logger.warning('Failed to mark status $statusId as viewed: $error');
    }
  }

  void _startRefreshLoop() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      unawaited(loadStatuses());
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}
