import 'package:flutter/material.dart';

class MessageBubbleTail extends CustomPainter {
  final Color color;
  final bool isMine;

  MessageBubbleTail({
    required this.color,
    required this.isMine,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path();

    if (isMine) {
      // Right tail
      path.moveTo(0, 0);
      path.quadraticBezierTo(size.width, 0, size.width, size.height);
      path.lineTo(0, size.height);
      path.close();
    } else {
      // Left tail
      path.moveTo(size.width, 0);
      path.quadraticBezierTo(0, 0, 0, size.height);
      path.lineTo(size.width, size.height);
      path.close();
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    return false;
  }
}
