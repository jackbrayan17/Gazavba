import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CallsScreen extends StatelessWidget {
  const CallsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: ListView.builder(
        itemCount: 10,
        itemBuilder: (context, index) {
          final isMissed = index % 3 == 0;
          final isVideo = index % 2 == 0;
          final isIncoming = index % 4 == 0;

          return ListTile(
            leading: CircleAvatar(
              radius: 24,
              backgroundColor: colorScheme.primaryContainer,
              child: Icon(Icons.person, color: colorScheme.onPrimaryContainer),
            ),
            title: Text(
              'Contact ${index + 1}',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isMissed ? colorScheme.error : colorScheme.onSurface,
              ),
            ),
            subtitle: Row(
              children: [
                Icon(
                  isIncoming ? Icons.call_received : Icons.call_made,
                  size: 16,
                  color: isMissed ? colorScheme.error : Colors.green,
                ),
                const SizedBox(width: 4),
                Text(
                  DateFormat('dd/MM HH:mm').format(
                    DateTime.now().subtract(Duration(hours: index * 2)),
                  ),
                ),
              ],
            ),
            trailing: IconButton(
              icon: Icon(
                isVideo ? Icons.videocam_rounded : Icons.call_rounded,
                color: colorScheme.primary,
              ),
              onPressed: () {
                // TODO: Initiate call
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: New call
        },
        child: const Icon(Icons.add_call),
      ),
    );
  }
}
