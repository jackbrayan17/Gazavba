import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/providers/notification_provider.dart';

void main() {
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  final notificationService = NotificationService();

  @override
  void initState() {
    super.initState();
    initialiseNotifications();
  }

  Future<void> initialiseNotifications() async {
    await notificationService.initialise();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gazavba',
      home: Scaffold(
        appBar: AppBar(title: const Text('Gazavba')),
        body: const Center(child: Text('Hello Flutter Web!')),
      ),
    );
  }
}
