import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/controllers/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/auth/presentation/profile_setup_screen.dart';
import '../features/auth/presentation/register_draft.dart';
import '../core/models/chat.dart';
import '../features/chat/presentation/chat_detail_screen.dart';
import '../features/chat/presentation/chats_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/status/presentation/status_screen.dart';
import '../widgets/home_shell.dart';
import '../widgets/splash_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);
  final authNotifier = ref.watch(authControllerProvider.notifier);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: GoRouterRefreshStream(authNotifier.stream),
    redirect: (context, state) {
      final isAuth = authState.isAuthenticated;
      final bootstrapped = authState.bootstrapComplete;
      final location = state.matchedLocation;
      final inAuthFlow = location.startsWith('/auth');
      final isSplash = location == '/splash';

      if (!bootstrapped) {
        return isSplash ? null : '/splash';
      }

      if (!isAuth) {
        return inAuthFlow ? null : '/auth/login';
      }

      if (inAuthFlow || isSplash) {
        return '/home/chats';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/auth/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/auth/profile-setup',
        builder: (context, state) {
          final draft = state.extra as RegisterDraft?;
          final phone = draft?.phone ?? state.uri.queryParameters['phone'];
          final password = draft?.password;
          return ProfileSetupScreen(
            draft: draft ?? RegisterDraft(phone: phone ?? '', password: password ?? ''),
          );
        },
      ),
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(
            path: '/home/chats',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ChatsScreen(),
            ),
            routes: [
              GoRoute(
                path: 'conversation/:chatId',
                builder: (context, state) {
                  final chatId = state.pathParameters['chatId']!;
                  final title = state.uri.queryParameters['title'];
                  final chat = state.extra is Chat ? state.extra as Chat : null;
                  return ChatDetailScreen(chatId: chatId, title: title, initialChat: chat);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/home/status',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: StatusScreen(),
            ),
          ),
          GoRoute(
            path: '/home/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
