import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
    this.mutedUserIds = const {},
    this.blockedUserIds = const {},
  });

  final List<Status> statuses;
  final bool isLoading;
  final String? error;
  final int unseenCount;
  final Set<String> mutedUserIds;
  final Set<String> blockedUserIds;

  StatusState copyWith({
    List<Status>? statuses,
    bool? isLoading,
    String? error,
    int? unseenCount,
    Set<String>? mutedUserIds,
    Set<String>? blockedUserIds,
    bool clearError = false,
  }) {
    return StatusState(
      statuses: statuses ?? this.statuses,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : error ?? this.error,
      unseenCount: unseenCount ?? this.unseenCount,
      mutedUserIds: mutedUserIds ?? this.mutedUserIds,
      blockedUserIds: blockedUserIds ?? this.blockedUserIds,
    );
  }
}

class StatusController extends StateNotifier<StatusState> {
  StatusController({required this.repository})
      : _logger = Logger('StatusController'),
        super(const StatusState()) {
    unawaited(_initialisePreferences());
  }

  final StatusRepository repository;
  final Logger _logger;
  Timer? _refreshTimer;
  SharedPreferences? _prefs;

  static const _mutedKey = 'gazavba_status_muted';
  static const _blockedKey = 'gazavba_status_blocked';

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
      final filtered = statuses
          .where((status) => !state.blockedUserIds.contains(status.userId))
          .toList();
      final unseen = await repository.unseenCount();
      this.state = state.copyWith(
        statuses: filtered,
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

  bool isMuted(String userId) => state.mutedUserIds.contains(userId);

  bool isBlocked(String userId) => state.blockedUserIds.contains(userId);

  Future<void> toggleMute(String userId) async {
    final muted = Set<String>.from(state.mutedUserIds);
    if (!muted.add(userId)) {
      muted.remove(userId);
    }
    state = state.copyWith(mutedUserIds: muted);
    await _prefs?.setStringList(_mutedKey, muted.toList());
  }

  Future<void> toggleBlock(String userId) async {
    final blocked = Set<String>.from(state.blockedUserIds);
    if (!blocked.add(userId)) {
      blocked.remove(userId);
    }
    final muted = Set<String>.from(state.mutedUserIds)..remove(userId);
    final filteredStatuses = state.statuses
        .where((status) => !blocked.contains(status.userId))
        .toList();
    state = state.copyWith(
      blockedUserIds: blocked,
      statuses: filteredStatuses,
      mutedUserIds: muted,
    );
    await _prefs?.setStringList(_blockedKey, blocked.toList());
    await _prefs?.setStringList(_mutedKey, muted.toList());
  }

  Future<Result<String>> download(Status status) async {
    if (status.mediaUrl == null) {
      return Failure(ApiException('Ce statut ne contient pas de média à enregistrer.'));
    }
    final granted = await _ensureStoragePermissions();
    if (!granted) {
      return Failure(ApiException('Permission requise pour enregistrer le statut.'));
    }
    try {
      final directory = await _resolveStatusDirectory();
      final path = await repository.downloadStatusMedia(
        status: status,
        directoryPath: directory.path,
      );
      return Success(path);
    } catch (error) {
      return Failure(error);
    }
  }

  void _startRefreshLoop() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      unawaited(loadStatuses());
    });
  }

  Future<void> _initialisePreferences() async {
    _prefs = await SharedPreferences.getInstance();
    final muted = _prefs?.getStringList(_mutedKey) ?? const [];
    final blocked = _prefs?.getStringList(_blockedKey) ?? const [];
    state = state.copyWith(
      mutedUserIds: muted.toSet(),
      blockedUserIds: blocked.toSet(),
    );
  }

  Future<bool> _ensureStoragePermissions() async {
    final permissions = <Permission>{};
    if (Platform.isAndroid) {
      permissions.add(Permission.storage);
      permissions.add(Permission.photos);
      permissions.add(Permission.videos);
      permissions.add(Permission.audio);
    } else if (Platform.isIOS) {
      permissions.add(Permission.photos);
    }

    if (permissions.isEmpty) {
      return true;
    }

    for (final permission in permissions) {
      if (await permission.isGranted) {
        continue;
      }
      final result = await permission.request();
      if (!result.isGranted) {
        return false;
      }
    }
    return true;
  }

  Future<Directory> _resolveStatusDirectory() async {
    Directory base;
    if (Platform.isAndroid) {
      base = await getExternalStorageDirectory() ?? await getApplicationDocumentsDirectory();
    } else {
      base = await getApplicationDocumentsDirectory();
    }
    final directory = Directory('${base.path}/Gazavba/status');
    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }
    return directory;
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}
