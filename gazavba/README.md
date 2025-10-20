# Gazavba

Gazavba is a realtime messaging experience built with an Expo (React Native) frontend and a Node.js + SQLite backend. This guide explains how to get the API and the client running together, how authentication works with phone numbers, which demo credentials are seeded automatically, and how to verify that the production instance hosted at **https://gazavba.eeuez.com** is reachable from your device.

## Requirements

- Node.js 18+
- npm 9+
- For the backend: SQLite is bundled so no extra database setup is required
- For the frontend: Expo CLI (`npx expo`) plus either Expo Go, an Android/iOS simulator, or web support

## Production backend at gazavba.eeuez.com

The Expo app is preconfigured to talk to the hosted backend at `https://gazavba.eeuez.com`. Every request automatically targets `https://gazavba.eeuez.com/api/...` and Socket.IO connects to `https://gazavba.eeuez.com`. No extra environment variables are required when you simply run `npx expo start` and open the project in Expo Go from your phone.

If you want to confirm the hosted backend is reachable (or debug connectivity issues), run the diagnostics helper from the project root:

```bash
npm install          # first time setup
npm run diagnostics  # hits /health and optionally logs in + opens a socket
```

- To exercise the login + socket path, export demo credentials before running the script:

  ```bash
  export GAZAVBA_TEST_PHONE=+237612345678
  export GAZAVBA_TEST_PASSWORD=password123
  npm run diagnostics
  ```

- When the script succeeds you will see explicit `✔` logs for the REST health endpoint and the socket handshake. If something fails the script prints the failing URL and status code so you can adjust firewall/CORS settings on the hosting provider.

You only need to run a local backend if you plan to develop API features yourself. Otherwise the hosted instance is ready to use.

## 1. Start the backend API locally (optional)

```bash
cd backend
cp .env.example .env           # adjust values if needed
npm install
npm run init-db                # creates tables and demo accounts
npm run dev                    # or `npm start` for production mode
```

The `init-db` script seeds the database and prints a list of phone/password pairs you can use to log in. By default the API listens on http://localhost:3000 and exposes REST routes under `/api`. Socket.IO uses the same host/port without the `/api` suffix. When you deploy the same code to hosting (such as the production instance) both `/api/auth/...` and `/auth/...` are supported so the Expo app can talk to either path.

## 2. Start the Expo frontend

Install dependencies from the project root:

```bash
npm install
```

### Connecting to the hosted backend (Expo Go on your phone)

1. Install dependencies if you have not already: `npm install`.
2. Start Expo: `npx expo start`.
3. Scan the QR code with Expo Go. The app will automatically communicate with `https://gazavba.eeuez.com` thanks to the default configuration in `src/services/api.js` and `src/services/socket.js`.
4. Log in with any seeded demo account (see the table below) or register a brand new account. Debug logs in Metro will show both REST calls and socket events so you can verify the handshake.

### Connecting to a local backend (development workstation)

When launching Expo against a backend running on your machine, provide explicit environment variables so requests and the socket handshake resolve to your LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000/api \
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000 \
npx expo start
```

- If you are using an Android emulator, `EXPO_PUBLIC_API_URL` can be set to `http://10.0.2.2:3000/api` and `EXPO_PUBLIC_SOCKET_URL` to `http://10.0.2.2:3000`.
- When testing on a real device, replace `localhost` with your computer's LAN IP (e.g. `http://192.168.x.x:3000`).

The frontend automatically stores the JWT it receives, reconnects sockets when the app restarts, and shows inline alerts for registration/login failures.

For extra visibility while debugging, Metro logs include messages such as `[ApiService] → Request`, `[ApiService] ← Response`, `[AuthContext] backend reachable`, and `[SocketService] initializing connection` so you can follow every step of the handshake.

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
- `npm run diagnostics` – run connectivity checks against the configured API & socket URLs

With both servers running you can register new users, sign in with a phone number and password, exchange messages in realtime via Socket.IO, and see other seeded accounts online immediately.
