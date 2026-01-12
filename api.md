# Gazavba API Reference

This document describes the REST and real-time endpoints exposed by the Gazavba backend. All paths are relative to the backend server root.

## Base URLs

| Purpose | Description | Example |
| --- | --- | --- |
| REST API | Prefix for all HTTP endpoints | `https://<host>/api` |
| File assets | Base path for uploaded avatars and statuses | `https://<host>/uploads/<filename>` |
| Socket.IO | Real-time namespace | `wss://<host>` (connect with Socket.IO client) |

Configure the Expo client with `EXPO_PUBLIC_API_URL` (e.g. `https://<host>/api`) and `EXPO_PUBLIC_SOCKET_URL` (e.g. `https://<host>`). Authentication uses JWT tokens returned during login or registration; send them in the `Authorization: Bearer <token>` header for protected routes.

## Health Check

`GET /health`

Returns a simple status payload and does not require authentication.

---

## Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Create a new user. Accepts JSON or `multipart/form-data` (when uploading an avatar).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | ✅ | User display name |
| `phone` | string | ✅ | Any format; digits and `+` retained |
| `password` | string | ✅ | Minimum 6 characters |
| `email` | string | ❌ | Must be valid email if provided |
| `avatar` | string | ❌ | URL fallback when no file is uploaded |
| `role` | string | ❌ | Defaults to `user` |

If `multipart/form-data` is used, include an image file under the `avatar` field. The response includes the persisted user (without password) and a JWT token.

### `POST /api/auth/login`
Authenticate with an email or phone.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `identifier` | string | ✅* | Email or phone; `email` or `phone` may be supplied instead |
| `password` | string | ✅ | |

Returns the authenticated user profile (without password) and a JWT token. The backend normalizes emails to lowercase and phone numbers to digits plus leading `+`.

### `GET /api/auth/verify`
Validates the bearer token and returns the associated user profile. Requires `Authorization` header.

### `POST /api/auth/logout`
Marks the authenticated user as offline. Requires `Authorization` header.

---

## User Endpoints (`/api/users`)

All routes below require a bearer token.

### `GET /api/users`
List every user. Returns `id`, `name`, `email`, `phone`, `avatar`, `role`, `isSuperAdmin`, `isOnline`, `lastSeen`, `createdAt`, and `updatedAt`.

### `GET /api/users/search?q=<term>`
Search users by partial match on `name`, `email`, or `phone`.

### `GET /api/users/profile`
Return the authenticated user’s full record.

### `PUT /api/users/profile`
Update profile details. Accepts any subset of:

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | |
| `email` | string | Stored as-is; provide valid email format |
| `phone` | string | Normalized to digits/`+` |

Responds with the updated user.

### `POST /api/users/avatar`
Upload a new avatar image. Send as `multipart/form-data` with a single `avatar` image file (≤ 5 MiB). Response contains `{ avatar: "/uploads/<file>" }`.

### `POST /api/users/match-contacts`
Match device contacts against registered users.

Request body: `{ "contacts": ["+15555550123", "0555123456", ...] }`

Response: `{ matches: <array of user records>, unmatched: <array of normalized phone numbers without matches> }`.

### `POST /api/users/online`
Update the authenticated user’s presence state.

Request body: `{ "isOnline": true | false }`

---

## Chat Endpoints (`/api/chats`)

Bearer token required.

### `GET /api/chats`
Fetch chats the user participates in. Each chat includes participants, derived `displayName`, optional `avatar`, `unreadCount`, last message preview, and direct chat metadata.

### `POST /api/chats`
Create a chat.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `participants` | string[] | ✅ | List of user IDs (excluding the caller) |
| `type` | string | ❌ | `direct` (default) or `group` |
| `name` | string | ❌ | Used for groups |

For direct chats with a single participant, an existing conversation is reused.

### `GET /api/chats/:id`
Retrieve chat details, including participants and computed presentation data.

### `GET /api/chats/:id/participants`
Return all participants for the chat.

### `POST /api/chats/:id/participants`
Add a participant. Body: `{ "userId": "<id>" }`.

### `DELETE /api/chats/:id/participants/:userId`
Remove a participant from the chat.

### `POST /api/chats/:id/read`
Mark every message in the chat as read for the authenticated user.

---

## Message Endpoints (`/api/messages`)

Bearer token required.

### `GET /api/messages/chat/:chatId`
Fetch paginated messages for a chat.

Query parameters:

| Param | Default | Description |
| --- | --- | --- |
| `limit` | `50` | Maximum number of messages to return |
| `offset` | `0` | Number of rows to skip before selecting |

Messages include sender metadata (`senderName`, `senderAvatar`). They are returned in chronological order.

### `POST /api/messages`
Create a new message.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `chatId` | string | ✅ | Target chat |
| `text` | string | ✅ | Message body; required even when `messageType` ≠ `text` |
| `messageType` | string | ❌ | Defaults to `text`; accepts `image`, `video`, etc. |
| `mediaUrl` | string | ❌ | Link to uploaded asset |

Response contains the stored message, including generated `id` and `timestamp`.

### `POST /api/messages/:messageId/read`
Record that the authenticated user read a specific message.

### `DELETE /api/messages/:messageId`
Delete the given message.

### `GET /api/messages/chat/:chatId/unread`
Return `{ unreadCount: <number> }` for the chat.

---

## Status Endpoints (`/api/statuses`)

Bearer token required.

### `GET /api/statuses`
Return all active statuses from every user, augmented with `userName`, `userAvatar`, `viewCount`, and `hasViewed` (0 or 1).

### `GET /api/statuses/user/:userId`
List the specified user’s active statuses.

### `POST /api/statuses/text`
Create a 24-hour text status. Body: `{ "content": "..." }`.

### `POST /api/statuses/media`
Create an image or video status.

* Send `multipart/form-data` with a `media` file (≤ 10 MiB) and optional `content` string.
* Response includes the persisted status with `mediaUrl` pointing at `/uploads/...`.

### `POST /api/statuses/:statusId/view`
Mark the status as viewed by the caller.

### `GET /api/statuses/:statusId/viewers`
List viewers with timestamp metadata.

### `DELETE /api/statuses/:statusId`
Delete the given status.

### `GET /api/statuses/unseen/count`
Returns `{ count: <number> }` representing unseen statuses for the caller.

---

## Real-Time Events (Socket.IO)

Connect with Socket.IO to the backend origin. No authentication handshake is currently enforced; the client emits identifiers after connecting.

### Rooms and Presence

* `join` — payload: `userId`. The server joins the socket to `user_<userId>` room.
* `user_online` — payload: `userId`. Broadcasts `{ userId, isOnline: true }` to everyone else.

### Messaging

* `send_message` — payload:
  ```json
  {
    "chatId": "<chat-id>",
    "senderId": "<user-id>",
    "text": "Hello",
    "messageType": "text",
    "mediaUrl": null,
    "clientId": "<optional client message id>"
  }
  ```
  The server persists the message, looks up chat participants, and emits `new_message` to each recipient’s `user_<id>` room with `{ message, chatId, senderId, chatName, clientId }`. The sender receives `message_sent` containing the stored message plus `chatId`.

* `message_error` — emitted back to the sender when persistence fails (`{ error, clientId }`).

### Typing Indicators

* `typing_start` / `typing_stop` — payload `{ chatId, userId }`. Broadcast to room `chat_<chatId>` as `user_typing` with `{ userId, isTyping }`.

### Disconnection

Logging occurs server-side when a socket disconnects; no event is emitted to clients.

---

## Error Handling

Errors are returned as JSON objects containing an `error` message string. Validation failures use HTTP `400`, authentication issues use `401`/`403`, and unexpected errors return `500`.

