import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:intl/intl.dart';

import '../models/message.dart' as app;

class NotificationService {
  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();
  static const _accentColor = Color(0xFF389038);

  /// Initialise the notification plugin
  Future<void> initialise() async {
    const AndroidInitializationSettings androidInit =
        AndroidInitializationSettings('gazavba_monochrome');
    const InitializationSettings initSettings =
        InitializationSettings(android: androidInit);

    await flutterLocalNotificationsPlugin.initialize(initSettings);
  }

  /// Show latest messages as inbox-style notification
  Future<void> showLatestMessages(List<app.Message> messages) async {
    if (messages.isEmpty) return;

    messages.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final formatter = DateFormat.Hm();
    final List<String> inboxLines = messages.take(6).map((message) {
      final sender =
          (message.senderName?.isNotEmpty == true) ? message.senderName! : 'Message';
      final time = formatter.format(message.createdAt);
      final content = _describeContent(message);

      return '$sender • $time • $content';
    }).toList();

    final latest = messages.first;
    final latestTitle =
        (latest.senderName?.isNotEmpty == true) ? latest.senderName! : 'Nouveau message';
    final latestTime = formatter.format(latest.createdAt);
    final latestBody = '${_describeContent(latest)} • $latestTime';

    final AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'messages_channel',
      'Messages',
      channelDescription: 'Notifications pour les nouveaux messages Gazavba',
      importance: Importance.max,
      priority: Priority.high,
      category: AndroidNotificationCategory.message,
      icon: 'gazavba_monochrome',
      color: _accentColor,
      largeIcon: const DrawableResourceAndroidBitmap('notification_logo'),
      ticker: 'Nouveau message',
      styleInformation: InboxStyleInformation(
        inboxLines,
        contentTitle: latestTitle,
        summaryText: messages.length == 1
            ? latestTime
            : '${messages.length} nouveaux messages',
      ),
    );

    final NotificationDetails notificationDetails =
        NotificationDetails(android: androidDetails);

    await flutterLocalNotificationsPlugin.show(
      latest.createdAt.millisecondsSinceEpoch ~/ 1000,
      latestTitle,
      latestBody,
      notificationDetails,
    );
  }

  String _describeContent(app.Message message) {
    if (message.messageType != 'text' && message.mediaUrl != null) {
      switch (message.messageType) {
        case 'image':
          return 'Photo';
        case 'video':
          return 'Vidéo';
        case 'audio':
          return 'Audio';
        case 'file':
          return 'Fichier';
      }
      return message.messageType;
    }
    return message.content.trim().isEmpty ? 'Message' : message.content.trim();
  }
}
