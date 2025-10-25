import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';
import 'router/app_router.dart';

class GazavbaApp extends ConsumerWidget {
  const GazavbaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Gazavba',
      theme: AppTheme.light,
      routerConfig: router,
    );
  }
}
