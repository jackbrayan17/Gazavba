// src/services/api.js
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// -----------------------------
// URL resolution (env / dev LAN)
// -----------------------------
const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const API_ENV_URL = process.env.EXPO_PUBLIC_API_URL
  ? trimTrailingSlash(process.env.EXPO_PUBLIC_API_URL)
  : null;

const SOCKET_ENV_URL = process.env.EXPO_PUBLIC_SOCKET_URL
  ? trimTrailingSlash(process.env.EXPO_PUBLIC_SOCKET_URL)
  : null;

const resolveHostFromExpo = () => {
  const expoConfig = Constants?.expoConfig ?? {};
  const candidates = [
    expoConfig.hostUri,
    expoConfig.extra?.expoGo?.debuggerHost,
    expoConfig.extra?.expoGo?.hostUri,
  ];
  for (const candidate of candidates) {
    if (candidate) {
      const host = candidate.split(":")[0];
      if (host) return `http://${host}:3000`;
    }
  }
  return null;
};

function resolveBaseUrl() {
  if (API_ENV_URL) return API_ENV_URL;

  const expoHost = resolveHostFromExpo();
  if (expoHost) return `${expoHost}/api`;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3000/api`;
  }

  const host =
    Platform.OS === "android" ? "10.0.2.2" :
    Platform.OS === "ios" ? "localhost" :
    "127.0.0.1";
  return `http://${host}:3000/api`;
}

const BASE_URL = resolveBaseUrl();

const resolveSocketBaseUrl = () => {
  if (SOCKET_ENV_URL) return SOCKET_ENV_URL;
  if (BASE_URL.endsWith("/api")) return BASE_URL.slice(0, -4);
  return BASE_URL;
};

const SOCKET_BASE_URL = resolveSocketBaseUrl();

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
  } catch (e) {
    // en dernier recours (p. ex. SecureStore indispo), on ne crashe pas
    if (Platform.OS === "web") {
      try {
        webStore.setItemAsync(TOKEN_KEY, token);
      } catch {}
    }
  }
}

async function loadToken() {
  try {
    return await store.getItemAsync(TOKEN_KEY);
  } catch {
    if (Platform.OS === "web") {
      try {
        return await webStore.getItemAsync(TOKEN_KEY);
      } catch {
        return null;
      }
    }
    return null;
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
  }

  async setToken(token) {
    this.token = token || null;
    await saveToken(this.token);
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async request(
    endpoint,
    { method = "GET", body, auth = true, isFormData = false, headers = {} } = {}
  ) {
    const url = `${BASE_URL}${endpoint}`;

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

    let response;
    try {
      response = await fetch(url, config);
    } catch (netErr) {
      throw new Error(`Network error: ${netErr?.message || netErr}`);
    }

    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { message: raw };
    }

    if (!response.ok) {
      const msg =
        payload?.error ||
        payload?.message ||
        `Request failed (${response.status})`;
      if (response.status === 401) {
        // Optionnel: invalider la session localement
        // await this.setToken(null);
      }
      throw new Error(msg);
    }

    return payload;
  }

  // ---------- Auth ----------
  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: userData,
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
      // même si le backend échoue, on nettoie localement
    } finally {
      await this.setToken(null);
    }
  }

  // ---------- Users ----------
  async getUsers() {
    return this.request("/users", { auth: true });
  }

  async searchUsers(query) {
    return this.request(
      `/users/search?q=${encodeURIComponent(query)}`,
      { auth: true }
    );
  }

  async getUserProfile() {
    return this.request("/users/profile", { auth: true });
  }

  async updateProfile(updates) {
    return this.request("/users/profile", {
      method: "PUT",
      body: updates,
      auth: true,
    });
  }

  async uploadAvatar(image) {
    const payload = typeof image === "string" ? { uri: image } : image;
    const formData = new FormData();
    formData.append("avatar", {
      uri: payload?.uri,
      type: payload?.mimeType || "image/jpeg",
      name: payload?.name || "avatar.jpg",
    });
    return this.request("/users/avatar", {
      method: "POST",
      body: formData,
      isFormData: true,
      auth: true,
    });
  }

  async setOnlineStatus(isOnline) {
    return this.request("/users/online", {
      method: "POST",
      body: { isOnline },
      auth: true,
    });
  }

  async matchContacts(phoneNumbers = []) {
    return this.request("/users/match-contacts", {
      method: "POST",
      body: { contacts: phoneNumbers },
      auth: true,
    });
  }

  // ---------- Chats ----------
  async getChats() {
    return this.request("/chats", { auth: true });
  }

  async createChat(chatData) {
    return this.request("/chats", {
      method: "POST",
      body: chatData,
      auth: true,
    });
  }

  async getChat(chatId) {
    return this.request(`/chats/${chatId}`, { auth: true });
  }

  async markChatAsRead(chatId) {
    return this.request(`/chats/${chatId}/read`, {
      method: "POST",
      auth: true,
    });
  }

  // ---------- Messages ----------
  async getMessages(chatId, limit = 50, offset = 0) {
    return this.request(
      `/messages/chat/${chatId}?limit=${limit}&offset=${offset}`,
      { auth: true }
    );
  }

  async sendMessage(messageData) {
    return this.request("/messages", {
      method: "POST",
      body: messageData,
      auth: true,
    });
  }

  async markMessageAsRead(messageId) {
    return this.request(`/messages/${messageId}/read`, {
      method: "POST",
      auth: true,
    });
  }

  async deleteMessage(messageId) {
    return this.request(`/messages/${messageId}`, {
      method: "DELETE",
      auth: true,
    });
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
    return this.request("/statuses/text", {
      method: "POST",
      body: { content: content?.trim?.() ?? content },
      auth: true,
    });
  }

  async createMediaStatus({
    uri,
    mimeType = "image/jpeg",
    name = "status.jpg",
    content = "",
  }) {
    const formData = new FormData();
    formData.append("media", { uri, type: mimeType, name });
    formData.append("content", content);
    return this.request("/statuses/media", {
      method: "POST",
      body: formData,
      isFormData: true,
      auth: true,
    });
  }

  async markStatusAsViewed(statusId) {
    return this.request(`/statuses/${statusId}/view`, {
      method: "POST",
      auth: true,
    });
  }

  async getStatusViewers(statusId) {
    return this.request(`/statuses/${statusId}/viewers`, { auth: true });
  }

  async deleteStatus(statusId) {
    return this.request(`/statuses/${statusId}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async getUnseenStatusCount() {
    return this.request("/statuses/unseen/count", { auth: true });
  }
}

export default new ApiService();
