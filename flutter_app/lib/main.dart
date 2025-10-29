import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/database/app_database.dart';
import 'core/services/api_client.dart';
import 'core/services/socket_service.dart';
import 'core/services/supabase_service.dart';
import 'core/storage/secure_storage.dart';
import 'core/utils/provider_logger.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storage = await AppSecureStorage.create();
  final database = await AppDatabase.open();
  final apiClient = ApiClient(storage: storage, database: database);
  await apiClient.init();
  final socketService = SocketService();
  final supabaseService = SupabaseService.instance;
  await supabaseService.init();

  runApp(
    ProviderScope(
      observers: const [AppProviderObserver()],
      overrides: [
        secureStorageProvider.overrideWithValue(storage),
        databaseProvider.overrideWithValue(database),
        apiClientProvider.overrideWithValue(apiClient),
        socketServiceProvider.overrideWithValue(socketService),
        supabaseServiceProvider.overrideWithValue(supabaseService),
      ],
      child: const GazavbaApp(),
    ),
  );
}
