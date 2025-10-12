# Gazavba

Gazavba is a realtime messaging experience built with an Expo (React Native) frontend and a Node.js + SQLite backend. This guide explains how to get the API and the client running together, how authentication works with phone numbers, which demo credentials are seeded automatically, and how to generate a signed Android build.

## Product highlights

- Modern chat list with unread badges, quick search, and a one-tap dark/light toggle that persists between sessions.
- Contact sync that highlights friends who already use Gazavba and offers share/copy actions to invite others.
- Rich stories/statuses supporting photos, videos, or text posts, plus quick download and read receipts.
- Profile management with live avatar uploads, editable display name, and online presence indicators.

## Requirements

- Node.js 18+
- npm 9+
- For the backend: SQLite is bundled so no extra database setup is required
- For the frontend: Expo CLI (`npx expo`) plus either Expo Go, an Android/iOS simulator, or web support

## 1. Start the backend API

```bash
cd backend
cp .env.example .env           # adjust values if needed
npm install
npm run init-db                # creates tables and demo accounts
npm run dev                    # or `npm start` for production mode
```

The `init-db` script seeds the database and prints a list of phone/password pairs you can use to log in. By default the API listens on http://localhost:3000 and exposes REST routes under `/api`. Socket.IO uses the same host/port without the `/api` suffix.

## 2. Start the Expo frontend

Install dependencies from the project root:

```bash
npm install
```

When launching Expo, point it at your backend host. For local development on the same machine you can run:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000/api \
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000 \
npx expo start
```

- If you are using an Android emulator, `EXPO_PUBLIC_API_URL` can be set to `http://10.0.2.2:3000/api` and `EXPO_PUBLIC_SOCKET_URL` to `http://10.0.2.2:3000`.
- When testing on a real device, replace `localhost` with your computer's LAN IP (e.g. `http://192.168.x.x:3000`).

The frontend automatically stores the JWT it receives, reconnects sockets when the app restarts, and shows inline alerts for registration/login failures.

### Build an Android APK (standalone client)

Expo development builds are recommended for QA, but you can also produce a distributable `.apk` straight from this repository:

```bash
# 1. Install native tooling once (inside the project root)
npx expo prebuild --platform android

# 2. Generate a release build (Gradle will emit app/build/outputs/apk/release/app-release.apk)
cd android
./gradlew assembleRelease

# 3. (Optional) Install it on a connected device/emulator
adb install -r app/build/outputs/apk/release/app-release.apk
```

When using the Expo Application Services (EAS) workflow you can alternatively run `eas build -p android --profile preview` to produce a signed artifact in the cloud.

## Seeded demo accounts

After running `npm run init-db` inside the `backend` folder you can sign in with any of the following accounts:

| Name          | Phone          | Password     |
|---------------|----------------|--------------|
| Super Admin   | 699999999      | brayan8003   |
| Brenda        | +237612345678  | password123  |
| Marcus        | +237612345679  | password123  |
| Elena         | +237612345680  | password123  |
| Test User     | +237612345681  | password123  |

Registration and login both expect a **phone number + password**. Email remains optional during sign-up, but phone numbers must be unique. Successful registration logs users in immediately.

## Project structure

```
.
├── App.tsx                 # Expo entry (Expo Router is configured via app/)
├── app/                    # Expo Router screens (auth, tabs, chat, etc.)
├── src/                    # Shared components, contexts, services
├── backend/                # Express + Socket.IO API
│   ├── config/             # Database + auth helpers
│   ├── routes/             # REST endpoints (auth, chats, users, ...)
│   └── scripts/            # Database seeding utilities
└── README.md               # This guide
```

## Useful scripts

Backend:

- `npm run dev` – start Express with nodemon
- `npm run init-db` – create tables and seed demo data

Frontend:

- `npm run start` – launch Expo (make sure the env variables point to your backend)
- `npm run android` / `npm run ios` / `npm run web` – platform-specific builds

With both servers running you can register new users, sign in with a phone number and password, exchange messages in realtime via Socket.IO, and see other seeded accounts online immediately.
