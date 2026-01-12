import 'package:flutter/material.dart';

class StorageSettingsScreen extends StatelessWidget {
  const StorageSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Utilisation données et stockage'),
      ),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.folder_open_rounded),
            title: const Text('Gérer le stockage'),
            subtitle: const Text('2.3 Go utilisés'),
            onTap: () {},
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.data_usage_rounded),
            title: const Text('Utilisation du réseau'),
            subtitle: const Text('Envoyé: 1.2 Go • Reçu: 3.4 Go'),
            onTap: () {},
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'Téléchargement auto. des médias',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
            ),
          ),
          ListTile(
            title: const Text('En utilisant les données mobiles'),
            subtitle: const Text('Photos'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('En connexion Wi-Fi'),
            subtitle: const Text('Tout les médias'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('En itinérance'),
            subtitle: const Text('Aucun média'),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}
