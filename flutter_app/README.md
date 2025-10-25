# Gazavba Flutter

Réécriture Flutter de l'expérience de messagerie Gazavba. L'application consomme directement l'API de production **https://gazavba.eeuez.com/api** et reprend les fonctionnalités clés : authentification par numéro de téléphone, messagerie temps réel via Socket.IO, gestion du profil et onglet statuts.

## Prérequis

- Flutter 3.19+ installé et accessible dans le `PATH`
- Dart 3.3+
- Un émulateur Android/iOS, un appareil physique ou un navigateur Chrome pour le mode web

## Installation & exécution

Depuis le dossier `flutter_app/` :

```bash
flutter pub get
flutter run
```

Des scripts `.bat` sont fournis dans `scripts/` pour automatiser la préparation et le lancement sous Windows :

- `scripts\setup_and_run_android.bat` – installe les dépendances puis lance `flutter run` sur un émulateur Android (`emulator-5554` par défaut, passez `--device-id VOTRE_ID` en argument pour un autre appareil).
- `scripts\setup_and_run_web.bat` – lance l'app dans Chrome avec le moteur `html`.

## Architecture

```
lib/
├── app.dart                 # MaterialApp + GoRouter
├── main.dart                # Initialisation secure storage, API et socket
├── core/                    # Services, modèles, thèmes, utilitaires
├── features/
│   ├── auth/                # Authentification, inscription, profil
│   ├── chat/                # Liste de conversations, détails, socket
│   ├── status/              # Onglet statuts
│   └── profile/             # Vue profil + paramètres
├── router/                  # Définition des routes GoRouter
└── widgets/                 # Splash screen, navigation shell, composants UI
```

### Services clés

- `ApiClient` gère toutes les requêtes HTTP vers `https://gazavba.eeuez.com/api`, y compris la persistance du JWT dans `flutter_secure_storage` (fallback `SharedPreferences` sur web).
- `SocketService` établit la connexion Socket.IO sécurisée et expose un flux temps réel des messages entrants.
- `AuthRepository` / `ChatRepository` encapsulent respectivement les endpoints REST d'authentification et de messagerie.

### State management

L'application s'appuie sur **Riverpod** (`StateNotifier`) pour :

- Suivre la session utilisateur (`authControllerProvider`)
- Charger et mettre à jour les conversations/messages (`chatControllerProvider`)
- Propager automatiquement les redirections de navigation via `GoRouterRefreshStream`

## Sécurité & robustesse

- Stockage du token JWT dans un conteneur sécurisé (`flutter_secure_storage` ou fallback chiffré).
- Gestion centralisée des erreurs réseau (`ApiException`, `NetworkException`).
- Timeouts par défaut (15s connect, 20s read/write) et logs structurés via `logging`.
- Présence utilisateur rafraîchie automatiquement toutes les minutes (`/users/online`).

## Personnalisation UI/UX

- Thème Material 3 personnalisé (`AppTheme`).
- Animations implicites pour le splash, la navigation par onglets, les skeleton loaders et les actions de formulaires.
- Bulles de messages inspirées des messageries modernes avec en-têtes par jour.

## Tests rapides

```bash
flutter analyze
flutter test
```

Les commandes ci-dessus garantissent que le projet reste conforme aux lint Flutter officiels.

## Variables d'environnement optionnelles

Pour rediriger vers une autre instance API/socket sans modifier le code, compilez avec :

```bash
flutter run \
  --dart-define=GAZAVBA_API_URL=https://votre-api/api \
  --dart-define=GAZAVBA_SOCKET_URL=https://votre-api
```

## Support

Les logs détaillés (`ApiClient`, `SocketService`, `Provider`) sont disponibles dans la console pour accélérer le diagnostic lors du développement.
