import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

import 'voice_recorder_button.dart';

class ChatInputBar extends StatefulWidget {
  const ChatInputBar({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onChanged,
    this.isLoading = false,
    this.onPickAttachment,
    this.onOpenCamera,
  });

  final TextEditingController controller;
  final VoidCallback onSend;
  final ValueChanged<String> onChanged;
  final bool isLoading;
  final Future<void> Function()? onPickAttachment;
  final Future<void> Function()? onOpenCamera;

  @override
  State<ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends State<ChatInputBar> {
  bool _showSendButton = false;
  final FocusNode _focusNode = FocusNode();

  bool get _isMobile =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
    if (_isMobile) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    final show = widget.controller.text.trim().isNotEmpty;
    if (show != _showSendButton) {
      setState(() {
        _showSendButton = show;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(
                    color: colorScheme.outlineVariant.withOpacity(0.3),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                // Thicker input bar with increased padding for pill appearance
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      icon: Icon(Icons.emoji_emotions_outlined,
                          color: colorScheme.onSurfaceVariant),
                      onPressed: () {
                        // TODO: Open emoji picker
                      },
                    ),
                    Expanded(
                      child: TextField(
                        controller: widget.controller,
                        minLines: 1,
                        maxLines: 5,
                        autofocus: _isMobile,
                        focusNode: _focusNode,
                        onChanged: widget.onChanged,
                        style: const TextStyle(fontSize: 16),
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          border: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          // Increased vertical padding for thicker pill input
                          contentPadding:
                              EdgeInsets.symmetric(vertical: 16, horizontal: 4),
                          isDense: true,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.attach_file_rounded,
                          color: colorScheme.onSurfaceVariant),
                      onPressed:
                          widget.onPickAttachment == null || widget.isLoading
                              ? null
                              : () async {
                                  await widget.onPickAttachment!();
                                },
                    ),
                    if (!_showSendButton)
                      IconButton(
                        icon: Icon(Icons.camera_alt_rounded,
                            color: colorScheme.onSurfaceVariant),
                        onPressed:
                            widget.onOpenCamera == null || widget.isLoading
                                ? null
                                : () async {
                                    await widget.onOpenCamera!();
                                  },
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            _showSendButton
                ? GestureDetector(
                    onTap: widget.isLoading ? null : widget.onSend,
                    child: CircleAvatar(
                      radius: 24,
                      backgroundColor: colorScheme.primary,
                      child: Icon(
                        Icons.send_rounded,
                        color: colorScheme.onPrimary,
                      ),
                    ),
                  )
                : VoiceRecorderButton(
                    onRecordStart: () {
                      // TODO: Start audio recording logic
                    },
                    onRecordEnd: (path) {
                      // TODO: Send audio message
                    },
                    onCancel: () {
                      // TODO: Cancel recording
                    },
                  ),
          ],
        ),
      ),
    );
  }
}
