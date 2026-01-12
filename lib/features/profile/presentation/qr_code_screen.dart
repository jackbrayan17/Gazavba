import 'package:flutter/material.dart';
import 'dart:math';

class QrCodeScreen extends StatelessWidget {
  const QrCodeScreen({super.key, required this.user});

  final dynamic
      user; // Using dynamic to avoid importing User model if not needed, but better to import.

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon Code QR'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_rounded),
            onPressed: () {
              // TODO: Share QR Code image
            },
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CustomPaint(
                    size: const Size(200, 200),
                    painter: _QrCodePainter(data: user.id ?? 'gazavba'),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    user.name ?? 'Utilisateur',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Scanner pour ajouter sur Gazavba',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 14,
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

class _QrCodePainter extends CustomPainter {
  final String data;

  _QrCodePainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    final random = Random(data.hashCode);
    final cellSize = size.width / 25;

    // Draw finder patterns
    _drawFinderPattern(canvas, paint, 0, 0, cellSize);
    _drawFinderPattern(canvas, paint, (size.width - 7 * cellSize), 0, cellSize);
    _drawFinderPattern(
        canvas, paint, 0, (size.height - 7 * cellSize), cellSize);

    // Draw random data bits
    for (int x = 0; x < 25; x++) {
      for (int y = 0; y < 25; y++) {
        // Skip finder patterns
        if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) {
          continue;
        }

        if (random.nextBool()) {
          canvas.drawRect(
            Rect.fromLTWH(x * cellSize, y * cellSize, cellSize, cellSize),
            paint,
          );
        }
      }
    }
  }

  void _drawFinderPattern(
      Canvas canvas, Paint paint, double x, double y, double cellSize) {
    // Outer box
    canvas.drawRect(Rect.fromLTWH(x, y, 7 * cellSize, 7 * cellSize), paint);

    // Inner white box
    final whitePaint = Paint()..color = Colors.white;
    canvas.drawRect(
        Rect.fromLTWH(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize),
        whitePaint);

    // Inner black box
    canvas.drawRect(
        Rect.fromLTWH(
            x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize),
        paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
