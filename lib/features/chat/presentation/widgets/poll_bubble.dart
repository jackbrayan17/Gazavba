import 'package:flutter/material.dart';

class PollBubble extends StatelessWidget {
  const PollBubble({
    super.key,
    required this.question,
    required this.options,
    required this.totalVotes,
    required this.onVote,
    required this.userVote,
    required this.isMine,
  });

  final String question;
  final List<Map<String, dynamic>> options; // {id, text, count}
  final int totalVotes;
  final Function(String optionId) onVote;
  final String? userVote;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textColor = isMine ? colorScheme.onPrimary : colorScheme.onSurface;
    final barColor = isMine
        ? Colors.white.withOpacity(0.2)
        : colorScheme.primary.withOpacity(0.1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          question,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: textColor,
          ),
        ),
        const SizedBox(height: 12),
        ...options.map((option) {
          final percent =
              totalVotes == 0 ? 0.0 : (option['count'] as int) / totalVotes;
          final isSelected = userVote == option['id'];

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              onTap: () => onVote(option['id']),
              borderRadius: BorderRadius.circular(12),
              child: Stack(
                children: [
                  // Progress Bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: LinearProgressIndicator(
                      value: percent,
                      minHeight: 40,
                      backgroundColor: Colors.transparent,
                      valueColor: AlwaysStoppedAnimation(barColor),
                    ),
                  ),
                  // Content
                  Container(
                    height: 40,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: isSelected
                            ? colorScheme.secondary
                            : Colors.transparent,
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        if (isSelected)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Icon(Icons.check_circle,
                                size: 16, color: colorScheme.secondary),
                          ),
                        Expanded(
                          child: Text(
                            option['text'],
                            style: TextStyle(color: textColor),
                          ),
                        ),
                        Text(
                          '${(percent * 100).toInt()}%',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: textColor.withOpacity(0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 4),
        Text(
          '$totalVotes votes',
          style: TextStyle(
            fontSize: 12,
            color: textColor.withOpacity(0.7),
          ),
        ),
      ],
    );
  }
}
