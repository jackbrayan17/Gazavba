import 'package:flutter/material.dart';

class VoiceRecorderButton extends StatefulWidget {
  const VoiceRecorderButton({
    super.key,
    required this.onRecordStart,
    required this.onRecordEnd,
    required this.onCancel,
  });

  final VoidCallback onRecordStart;
  final Function(String path) onRecordEnd; // Mock path for now
  final VoidCallback onCancel;

  @override
  State<VoiceRecorderButton> createState() => _VoiceRecorderButtonState();
}

class _VoiceRecorderButtonState extends State<VoiceRecorderButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  double _dragOffset = 0.0;
  bool _isLocked = false;
  bool _isRecording = false;
  DateTime? _startTime;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _startRecording() {
    setState(() {
      _isRecording = true;
      _startTime = DateTime.now();
    });
    widget.onRecordStart();
  }

  void _stopRecording() {
    if (_isRecording) {
      widget.onRecordEnd('mock_audio_path.aac');
      _reset();
    }
  }

  void _cancelRecording() {
    widget.onCancel();
    _reset();
  }

  void _reset() {
    setState(() {
      _isRecording = false;
      _isLocked = false;
      _dragOffset = 0.0;
      _startTime = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        if (_isRecording && !_isLocked)
          Positioned(
            right: 60,
            child: Opacity(
              opacity: (1 - (-_dragOffset / 100)).clamp(0.0, 1.0),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.arrow_back_ios_new_rounded,
                      size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    'Glisser pour annuler',
                    style: TextStyle(color: colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ),
        if (_isRecording && _isLocked)
          Positioned(
            bottom: 60,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Text('Enregistrement verrouillé...'),
            ),
          ),
        GestureDetector(
          onLongPressStart: (_) => _startRecording(),
          onLongPressEnd: (details) {
            if (_isLocked) return;
            if (_dragOffset < -100) {
              _cancelRecording();
            } else {
              _stopRecording();
            }
          },
          onLongPressMoveUpdate: (details) {
            if (_isLocked) return;

            // Vertical drag to lock
            if (details.offsetFromOrigin.dy < -50) {
              setState(() => _isLocked = true);
            }

            // Horizontal drag to cancel
            setState(() {
              _dragOffset = details.offsetFromOrigin.dx;
            });
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: _isRecording ? 60 : 48,
            height: _isRecording ? 60 : 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isRecording ? Colors.red : colorScheme.primary,
              boxShadow: _isRecording
                  ? [
                      BoxShadow(
                        color: Colors.red.withOpacity(0.4),
                        blurRadius: 10,
                        spreadRadius: 2,
                      )
                    ]
                  : null,
            ),
            child: Icon(
              _isLocked ? Icons.stop_rounded : Icons.mic_rounded,
              color: colorScheme.onPrimary,
              size: _isRecording ? 32 : 24,
            ),
          ),
        ),
      ],
    );
  }
}
