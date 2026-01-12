import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class StatusScreen extends StatelessWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: ListView(
        children: [
          ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: Stack(
              children: [
                const CircleAvatar(
                  radius: 28,
                  backgroundImage:
                      AssetImage('assets/images/gazavba.png'), // Placeholder
                  child: Icon(Icons.person, size: 32),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: colorScheme.surface,
                      shape: BoxShape.circle,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.add,
                        size: 12,
                        color: colorScheme.onPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            title: const Text(
              'Mon statut',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: const Text('Appuyez pour ajouter un statut'),
            onTap: () {
              // TODO: Open camera/status creator
            },
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'Mises à jour récentes',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.grey,
              ),
            ),
          ),
          // Mock Status Items
          ...List.generate(5, (index) {
            return ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              leading: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: colorScheme.secondary,
                    width: 2,
                  ),
                ),
                child: CircleAvatar(
                  radius: 24,
                  backgroundColor: colorScheme.primaryContainer,
                  child: Text('U${index + 1}'),
                ),
              ),
              title: Text(
                'Contact ${index + 1}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text('Aujourd\'hui à 10:${30 + index}'),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) =>
                        StoryViewScreen(userName: 'Contact ${index + 1}'),
                  ),
                );
              },
            );
          }),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'text_status',
            onPressed: () {},
            backgroundColor: colorScheme.secondaryContainer,
            child: Icon(Icons.edit, color: colorScheme.onSecondaryContainer),
          ),
          const SizedBox(height: 16),
          FloatingActionButton(
            heroTag: 'camera_status',
            onPressed: () {},
            child: const Icon(Icons.camera_alt),
          ),
        ],
      ),
    );
  }
}

class StoryViewScreen extends StatefulWidget {
  const StoryViewScreen({super.key, required this.userName});

  final String userName;

  @override
  State<StoryViewScreen> createState() => _StoryViewScreenState();
}

class _StoryViewScreenState extends State<StoryViewScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..forward().whenComplete(() => Navigator.pop(context));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTapUp: (details) {
          final width = MediaQuery.of(context).size.width;
          if (details.globalPosition.dx < width / 3) {
            // Previous (restart for now)
            _controller.reset();
            _controller.forward();
          } else {
            // Next (finish)
            _controller.value = 1.0;
          }
        },
        onLongPressDown: (_) => _controller.stop(),
        onLongPressEnd: (_) => _controller.forward(),
        child: Stack(
          children: [
            // Story Content (Mock)
            Center(
              child: Container(
                color: Colors.primaries[
                    widget.userName.length % Colors.primaries.length],
                width: double.infinity,
                height: double.infinity,
                child: Center(
                  child: Text(
                    'Statut de ${widget.userName}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
            // Progress Bar
            Positioned(
              top: 40,
              left: 10,
              right: 10,
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  return LinearProgressIndicator(
                    value: _controller.value,
                    backgroundColor: Colors.white.withOpacity(0.3),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  );
                },
              ),
            ),
            // User Info
            Positioned(
              top: 55,
              left: 16,
              child: Row(
                children: [
                  const CircleAvatar(radius: 20, child: Icon(Icons.person)),
                  const SizedBox(width: 8),
                  Text(
                    widget.userName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
