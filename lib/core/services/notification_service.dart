import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/message.dart' as app;

class NotificationService {
  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
  FlutterLocalNotificationsPlugin();

  /// Initialise the notification plugin
  Future<void> initialise() async {
    const AndroidInitializationSettings androidInit =
    AndroidInitializationSettings('@mipmap/ic_launcher');
    const InitializationSettings initSettings =
    InitializationSettings(android: androidInit);

    await flutterLocalNotificationsPlugin.initialize(initSettings);
  }

  /// Show latest messages as inbox-style notification
  Future<void> showLatestMessages(List<app.Message> messages) async {
    if (messages.isEmpty) return;

    messages.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final List<String> inboxLines = messages.map((message) {
      final sender = (message.senderName?.isNotEmpty == true)
          ? '${message.senderName}: '
          : '';

      if (message.messageType != 'text' && message.mediaUrl != null) {
        return '$sender${message.messageType.toUpperCase()}';
      }

      return '$sender${message.content.trim()}';
    }).toList();

    final AndroidNotificationDetails androidDetails =
    AndroidNotificationDetails(
      'messages_channel',
      'Messages',
      styleInformation: InboxStyleInformation(
        inboxLines,
        contentTitle: 'New messages',
        summaryText: '${messages.length} new messages',
      ),
    );

    final NotificationDetails notificationDetails =
    NotificationDetails(android: androidDetails);

    await flutterLocalNotificationsPlugin.show(
      0,
      'Messages',
      'You have ${messages.length} new messages',
      notificationDetails,
    );
  }
}
