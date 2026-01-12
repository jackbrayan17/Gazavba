import 'package:flutter/material.dart';

class ChatWallpaper extends StatelessWidget {
  const ChatWallpaper({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Using a subtle pattern color based on the theme
    final patternColor = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return Stack(
      children: [
        // Solid background color
        Container(
          color: Theme.of(context).colorScheme.surface,
        ),
        // Doodle Pattern (simulated with a repeated icon pattern for now,
        // ideally this would be an SVG or Image asset)
        Positioned.fill(
          child: Opacity(
            opacity: 0.4,
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 6,
              ),
              itemBuilder: (context, index) {
                return Icon(
                  _getDoodleIcon(index),
                  color: patternColor,
                  size: 32,
                );
              },
            ),
          ),
        ),
        // Content
        child,
      ],
    );
  }

  IconData _getDoodleIcon(int index) {
    const icons = [
      Icons.star_border_rounded,
      Icons.favorite_border_rounded,
      Icons.music_note_rounded,
      Icons.pets_rounded,
      Icons.local_cafe_outlined,
      Icons.wb_sunny_outlined,
      Icons.nightlight_round_outlined,
      Icons.flight_takeoff_rounded,
      Icons.directions_bike_rounded,
      Icons.camera_alt_outlined,
    ];
    return icons[index % icons.length];
  }
}
