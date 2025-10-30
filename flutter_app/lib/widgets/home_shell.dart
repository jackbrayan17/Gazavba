import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.child});

  final Widget child;

  static const _tabs = [
    _HomeTab(path: '/home/chats', icon: Icons.chat_bubble_outline_rounded, label: 'Discussions'),
    _HomeTab(path: '/home/status', icon: Icons.timelapse_rounded, label: 'Statuts'),
    _HomeTab(path: '/home/profile', icon: Icons.person_outline_rounded, label: 'Profil'),
  ];

  int _indexForLocation(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) {
        return i;
      }
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final router = GoRouter.of(context);
    final location = router.location;
    final currentIndex = _indexForLocation(location);

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: child,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) {
          final target = _tabs[index];
          if (target.path != location) {
            router.go(target.path);
          }
        },
        destinations: _tabs
            .map(
              (tab) => NavigationDestination(
                icon: Icon(tab.icon),
                label: tab.label,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _HomeTab {
  const _HomeTab({required this.path, required this.icon, required this.label});

  final String path;
  final IconData icon;
  final String label;
}
