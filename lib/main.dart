import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/services/api_client.dart';
import 'core/services/log_service.dart';
import 'core/services/socket_service.dart';
import 'core/services/notification_service.dart';
import 'core/storage/secure_storage.dart';
import 'core/utils/provider_logger.dart';
import 'core/services/notification_service_provider.dart';


/// Entry point of the application.
Future<void> main() async {
  // Ensures Flutter engine + plugins are initialized
  WidgetsFlutterBinding.ensureInitialized();

  // Configure application logging before anything else
  final logService = await LogService.create();

  // Initialize secure storage
  final storage = await AppSecureStorage.create();

  // Initialize API client with persistent storage
  final apiClient = ApiClient(storage: storage);
  await apiClient.init();

  // Initialize real-time socket service using the API client
  final socketService = SocketService(apiClient: apiClient);

  // Prepare notification handling for foreground + background usage
  final notificationService = NotificationService();
  await notificationService.initialise();

  // Run the app with all core providers injected
  runApp(
    ProviderScope(
      observers: const [
        AppProviderObserver(), // Logs provider changes (for debugging)
      ],
      overrides: [
        logServiceProvider.overrideWithValue(logService),
        secureStorageProvider.overrideWithValue(storage),
        apiClientProvider.overrideWithValue(apiClient),
        socketServiceProvider.overrideWithValue(socketService),
        notificationServiceProvider.overrideWithValue(notificationService),
      ],
      child: const GazavbaApp(),
    ),
  );
}
