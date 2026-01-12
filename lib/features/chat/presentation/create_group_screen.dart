import 'package:flutter/material.dart';

class CreateGroupScreen extends StatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  State<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends State<CreateGroupScreen> {
  final List<String> _selectedContacts = [];
  final _groupNameController = TextEditingController();

  @override
  void dispose() {
    _groupNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nouveau groupe'),
            Text(
              '${_selectedContacts.length} sélectionné(s)',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Group Info Section
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceVariant,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.camera_alt_rounded,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextField(
                    controller: _groupNameController,
                    decoration: const InputDecoration(
                      hintText: 'Nom du groupe',
                      border: UnderlineInputBorder(),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.emoji_emotions_outlined),
                  onPressed: () {},
                ),
              ],
            ),
          ),
          const Divider(),
          // Contact Selection List
          Expanded(
            child: ListView.builder(
              itemCount: 20, // Mock contacts
              itemBuilder: (context, index) {
                final id = 'contact_$index';
                final isSelected = _selectedContacts.contains(id);
                return ListTile(
                  leading: Stack(
                    children: [
                      CircleAvatar(
                        backgroundColor:
                            Colors.primaries[index % Colors.primaries.length],
                        child: Text('C$index'),
                      ),
                      if (isSelected)
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check,
                                size: 16, color: Colors.white),
                          ),
                        ),
                    ],
                  ),
                  title: Text('Contact $index'),
                  subtitle: const Text('Hey there! I am using Gazavba.'),
                  onTap: () {
                    setState(() {
                      if (isSelected) {
                        _selectedContacts.remove(id);
                      } else {
                        _selectedContacts.add(id);
                      }
                    });
                  },
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: _selectedContacts.isNotEmpty
          ? FloatingActionButton(
              onPressed: () {
                // TODO: Create group logic
                Navigator.pop(context);
              },
              child: const Icon(Icons.check),
            )
          : null,
    );
  }
}
