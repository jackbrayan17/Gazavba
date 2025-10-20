// src/services/api.js
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// -----------------------------
// URL resolution (FORCÉ: domaine prod en dev & prod)
// -----------------------------
const trimTrailingSlash = (value) => (value ? value.replace(/\/+$/, "") : value);

const DEFAULT_API_URL = "https://gazavba.eeuez.com";
const DEFAULT_SOCKET_URL = "https://gazavba.eeuez.com";

const LOG_TAG = "[ApiService]";

const sanitizeForLog = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => {
        const lowered = key.toLowerCase();
        if (lowered.includes("password") || lowered.includes("token")) {
          return [key, typeof val === "string" ? "***" : "[redacted]"];
        }
        return [key, sanitizeForLog(val)];
      })
    );
  }
  return value;
};

// EXPO_PUBLIC_* optionnels, sinon domaine forcé
const API_ENV_URL = process.env.EXPO_PUBLIC_API_URL
  ? trimTrailingSlash(process.env.EXPO_PUBLIC_API_URL)
  : null;
const SOCKET_ENV_URL = process.env.EXPO_PUBLIC_SOCKET_URL
  ? trimTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL)
  : null;

const BASE_URL = trimTrailingSlash(API_ENV_URL || DEFAULT_API_URL);
const SOCKET_BASE_URL = trimTrailingSlash(SOCKET_ENV_URL || DEFAULT_SOCKET_URL);

console.log(`${LOG_TAG} Base URL resolved to: ${BASE_URL} (env=${process.env.NODE_ENV || "unknown"})`);
console.log(`${LOG_TAG} Socket Base URL resolved to: ${SOCKET_BASE_URL}`);

export const getApiBaseUrl = () => BASE_URL;
export const getSocketBaseUrl = () => SOCKET_BASE_URL;

// -----------------------------
// Storage helpers (SecureStore / web fallback)
// -----------------------------
const TOKEN_KEY = "access_token";

const webStore = {
  async setItemAsync(key, value) {
    if (typeof window !== "undefined" && window?.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  async getItemAsync(key) {
    if (typeof window !== "undefined" && window?.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  async deleteItemAsync(key) {
    if (typeof window !== "undefined" && window?.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

const store = Platform.OS === "web" ? webStore : SecureStore;

async function saveToken(token) {
  try {
    if (token) {
      await store.setItemAsync(TOKEN_KEY, token);
    } else {
      await store.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    if (Platform.OS === "web") {
      try { webStore.setItemAsync(TOKEN_KEY, token); } catch {}
    }
  }
}

async function loadToken() {
  try {
    return await store.getItemAsync(TOKEN_KEY);
  } catch {
    if (Platform.OS === "web") {
      try { return await webStore.getItemAsync(TOKEN_KEY); } catch { return null; }
    }
    return null;
  }
}

// -----------------------------
// fetch helper with timeout
// -----------------------------
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

// -----------------------------
// API service
// -----------------------------
class ApiService {
  constructor() {
    this.token = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.token = await loadToken();
    this.initialized = true;
    console.log(`${LOG_TAG} init completed`, { hasToken: !!this.token });
  }

  async setToken(token) {
    this.token = token || null;
    await saveToken(this.token);
    console.log(`${LOG_TAG} token updated`, { hasToken: !!this.token });
  }

  getHeaders(isFormData = false) {
    const headers = {};
    headers["Accept"] = "application/json";
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async request(
    endpoint,
    { method = "GET", body, auth = true, isFormData = false, headers = {}, timeoutMs = 15000 } = {}
  ) {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${path}`;

    if (auth && !this.token) {
      throw new Error("Access token required");
    }

    const config = {
      method,
      headers: { ...this.getHeaders(isFormData), ...headers },
    };

    if (body !== undefined) {
      config.body = isFormData ? body : JSON.stringify(body);
    }

    const logContext = {
      method, url, authRequired: auth, hasToken: !!this.token,
      headers: sanitizeForLog(config.headers),
      body: body !== undefined ? (isFormData ? "[form-data]" : sanitizeForLog(body)) : undefined,
    };
    console.log(`${LOG_TAG} → Request`, logContext);

    let response;
    try {
      response = await fetchWithTimeout(url, config, timeoutMs);
    } catch (netErr) {
      const errMsg =
        netErr?.name === "AbortError"
          ? `Network timeout after ${timeoutMs}ms`
          : (netErr?.message || "Network request failed");
      console.error(`${LOG_TAG} ✕ Network error`, { ...logContext, error: errMsg });
      throw new Error(`Network error: ${errMsg}`);
    }

    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { message: raw };
    }

    const responseLog = { status: response.status, ok: response.ok, payload: sanitizeForLog(payload) };

    if (!response.ok) {
      console.warn(`${LOG_TAG} ← Error response`, { ...logContext, ...responseLog });
      const msg = payload?.error || payload?.message || `Request failed (${response.status})`;
      if (response.status === 401) {
        // éventuel: await this.setToken(null);
      }
      throw new Error(msg);
    }

    console.log(`${LOG_TAG} ← Response`, { ...logContext, ...responseLog });
    return payload;
  }

  // --- Health check (diagnostic rapide) ---
  async ping() {
    return this.request("/health", { method: "GET", auth: false, timeoutMs: 8000 });
  }

  // ---------- Auth ----------
  async register(userData) {
    const { avatar, name, email, phone, password } = userData || {};
    const fd = new FormData();

    if (avatar?.uri) {
      fd.append("avatar", {
        uri: avatar.uri,
        name: avatar.name || "avatar.jpg",
        type: avatar.mimeType || "image/jpeg",
      });
    }
    if (name !== undefined) fd.append("name", `${name}`);
    if (email !== undefined) fd.append("email", `${email}`);
    if (phone !== undefined) fd.append("phone", `${phone}`);
    if (password !== undefined) fd.append("password", `${password}`);

    return this.request("/auth/register", {
      method: "POST",
      body: fd,
      isFormData: true,
      auth: false,
    });
  }

  async login(credentials) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: credentials,
      auth: false,
    });
    if (data?.token) await this.setToken(data.token);
    return data;
  }

  async verifyToken() {
    return this.request("/auth/verify", { auth: true });
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST", auth: true });
    } catch {
    } finally {
      await this.setToken(null);
    }
  }

  // ---------- Users ----------
  async getUsers() {
    return this.request("/users", { auth: true });
  }

  async searchUsers(query) {
    return this.request(`/users/search?q=${encodeURIComponent(query)}`, { auth: true });
  }

  async getUserProfile() {
    return this.request("/users/profile", { auth: true });
  }

  async updateProfile(updates) {
    return this.request("/users/profile", { method: "PUT", body: updates, auth: true });
  }

  async uploadAvatar(image) {
    const payload = typeof image === "string" ? { uri: image } : image;
    const formData = new FormData();
    formData.append("avatar", {
      uri: payload?.uri,
      type: payload?.mimeType || "image/jpeg",
      name: payload?.name || "avatar.jpg",
    });
    return this.request("/users/avatar", { method: "POST", body: formData, isFormData: true, auth: true });
  }

  async setOnlineStatus(isOnline) {
    return this.request("/users/online", { method: "POST", body: { isOnline }, auth: true });
  }

  async matchContacts(phoneNumbers = []) {
    return this.request("/users/match-contacts", { method: "POST", body: { contacts: phoneNumbers }, auth: true });
  }

  // ---------- Chats ----------
  async getChats() {
    return this.request("/chats", { auth: true });
  }

  async createChat(chatData) {
    return this.request("/chats", { method: "POST", body: chatData, auth: true });
  }

  async getChat(chatId) {
    return this.request(`/chats/${chatId}`, { auth: true });
  }

  async markChatAsRead(chatId) {
    return this.request(`/chats/${chatId}/read`, { method: "POST", auth: true });
  }

  // ---------- Messages ----------
  async getMessages(chatId, limit = 50, offset = 0) {
    return this.request(`/messages/chat/${chatId}?limit=${limit}&offset=${offset}`, { auth: true });
  }

  async sendMessage(messageData) {
    return this.request("/messages", { method: "POST", body: messageData, auth: true });
  }

  async markMessageAsRead(messageId) {
    return this.request(`/messages/${messageId}/read`, { method: "POST", auth: true });
  }

  async deleteMessage(messageId) {
    return this.request(`/messages/${messageId}`, { method: "DELETE", auth: true });
  }

  async getUnreadCount(chatId) {
    return this.request(`/messages/chat/${chatId}/unread`, { auth: true });
  }

  // ---------- Statuses ----------
  async getStatuses() {
    return this.request("/statuses", { auth: true });
  }

  async getUserStatuses(userId) {
    return this.request(`/statuses/user/${userId}`, { auth: true });
  }

  async createTextStatus(content) {
    return this.request("/statuses/text", { method: "POST", body: { content: content?.trim?.() ?? content }, auth: true });
  }

  async createMediaStatus({ uri, mimeType = "image/jpeg", name = "status.jpg", content = "" }) {
    const formData = new FormData();
    formData.append("media", { uri, type: mimeType, name });
    formData.append("content", content);
    return this.request("/statuses/media", { method: "POST", body: formData, isFormData: true, auth: true });
  }

  async markStatusAsViewed(statusId) {
    return this.request(`/statuses/${statusId}/view`, { method: "POST", auth: true });
  }

  async getStatusViewers(statusId) {
    return this.request(`/statuses/${statusId}/viewers`, { auth: true });
  }

  async deleteStatus(statusId) {
    return this.request(`/statuses/${statusId}`, { method: "DELETE", auth: true });
  }

  async getUnseenStatusCount() {
    return this.request("/statuses/unseen/count", { auth: true });
  }
}

export default new ApiService();
