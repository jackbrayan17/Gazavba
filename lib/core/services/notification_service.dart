import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import '../models/message.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  throw UnimplementedError('NotificationService must be initialised');
});

class NotificationService {
  NotificationService();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialised = false;
  DateTime? _lastSync;

  Future<void> initialise() async {
    if (_initialised) {
      return;
    }

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    final settings = const InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(settings);
    await _ensurePermissions();
    _initialised = true;
  }

  Future<void> _ensurePermissions() async {
    if (await Permission.notification.isGranted) {
      return;
    }
    final status = await Permission.notification.request();
    if (status.isPermanentlyDenied) {
      unawaited(openAppSettings());
    }
  }

  Future<void> showLatestMessages(List<Message> messages) async {
    if (!_initialised) {
      return;
    }

    if (messages.isEmpty) {
      await _plugin.cancel(_NotificationChannels.messagesId);
      return;
    }

    messages.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final latest = messages.take(4).toList();

    // Avoid spamming the notification shade if nothing changed.
    final newestTimestamp = latest.first.createdAt;
    if (_lastSync != null && !newestTimestamp.isAfter(_lastSync!)) {
      return;
    }
    _lastSync = newestTimestamp;

    final inboxLines = latest.map((message) {
      final sender = message.senderName?.isNotEmpty == true ? '${message.senderName}: ' : '';
      if (message.messageType != 'text' && message.mediaUrl != null) {
        switch (message.messageType) {
          case 'image':
            return '${sender}📷 Photo';
          case 'video':
            return '${sender}🎬 Vidéo';
          case 'audio':
            return '${sender}🎧 Audio';
          case 'file':
            return '${sender}📎 Fichier';
          default:
            return '${sender}${message.messageType.toUpperCase()}';
        }
      }
      final content = message.content.trim();
      if (content.isEmpty) {
        return '${sender}Message sécurisé';
      }
      return '$sender$content';
    }).toList();

    final android = AndroidNotificationDetails(
      _NotificationChannels.messagesChannel,
      'Messages Gazavba',
      channelDescription: 'Résumé des derniers messages sécurisés',
      importance: Importance.max,
      priority: Priority.high,
      styleInformation: InboxStyleInformation(
        inboxLines,
        summaryText: '${latest.length} derniers messages',
        contentTitle: 'Gazavba',
      ),
      ticker: 'Nouveaux messages Gazavba',
      enableVibration: true,
      playSound: true,
    );

    final ios = const DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: false,
      presentSound: true,
    );

    final details = NotificationDetails(android: android, iOS: ios);
    await _plugin.show(
      _NotificationChannels.messagesId,
      'Gazavba',
      'Vous avez des messages récents',
      details,
    );
  }
}

class _NotificationChannels {
  static const messagesChannel = 'gazavba_messages_channel';
  static const messagesId = 1001;
}
