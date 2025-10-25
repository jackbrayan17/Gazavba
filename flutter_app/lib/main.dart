import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/services/api_client.dart';
import 'core/services/socket_service.dart';
import 'core/storage/secure_storage.dart';
import 'core/utils/provider_logger.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storage = await AppSecureStorage.create();
  final apiClient = ApiClient(storage: storage);
  await apiClient.init();
  final socketService = SocketService(apiClient: apiClient);

  runApp(
    ProviderScope(
      observers: const [AppProviderObserver()],
      overrides: [
        secureStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(apiClient),
        socketServiceProvider.overrideWithValue(socketService),
      ],
      child: const GazavbaApp(),
    ),
  );
}
