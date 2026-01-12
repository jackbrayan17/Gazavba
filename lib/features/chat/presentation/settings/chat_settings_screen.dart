import 'package:flutter/material.dart';

class ChatSettingsScreen extends StatelessWidget {
  const ChatSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Discussions'),
      ),
      body: ListView(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'Affichage',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.brightness_6_rounded),
            title: const Text('Thème'),
            subtitle: const Text('Par défaut'),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.wallpaper_rounded),
            title: const Text('Fond d\'écran'),
            onTap: () {},
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'Paramètres des discussions',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
            ),
          ),
          SwitchListTile(
            value: true,
            onChanged: (val) {},
            title: const Text('Entrée pour envoyer'),
            subtitle: const Text('La touche Entrée envoie votre message'),
          ),
          SwitchListTile(
            value: true,
            onChanged: (val) {},
            title: const Text('Visibilité des médias'),
            subtitle:
                const Text('Afficher les médias téléchargés dans la galerie'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.cloud_upload_outlined),
            title: const Text('Sauvegarde des discussions'),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.history_rounded),
            title: const Text('Historique des discussions'),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}
