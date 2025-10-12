// src/services/api.js
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
// If you prefer AsyncStorage: import AsyncStorage from "@react-native-async-storage/async-storage";

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
      if (host) {
        return `http://${host}:3000`;
      }
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

  if (BASE_URL.endsWith("/api")) {
    return BASE_URL.slice(0, -4);
  }
  return BASE_URL;
};

const SOCKET_BASE_URL = resolveSocketBaseUrl();

export const getApiBaseUrl = () => BASE_URL;
export const getSocketBaseUrl = () => SOCKET_BASE_URL;

// ---- Storage helpers ----
const TOKEN_KEY = "access_token";
async function saveToken(token) {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function loadToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

// ---- API service ----
class ApiService {
  constructor() {
    this.token = null;
    this.initialized = false;
  }

  // Call once on app start (e.g., in your root component)
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
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Unified low-level request
  async request(endpoint, { method = "GET", body, auth = true, isFormData = false, headers = {} } = {}) {
    const url = `${BASE_URL}${endpoint}`;

    if (auth && !this.token) {
      // Prevent protected calls without a token
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
      // Network/connection error
      throw new Error(`Network error: ${netErr?.message || netErr}`);
    }

    // Try to parse JSON, fall back to text
    let payload;
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }

    if (!response.ok) {
      // Convenient message extraction
      const msg = payload?.error || payload?.message || `Request failed (${response.status})`;
      if (response.status === 401) {
        // Optional: auto-clear token on invalid session
        // await this.setToken(null);
      }
      throw new Error(msg);
    }

    return payload;
  }

  // ---------- Auth endpoints (public unless noted) ----------
  async register(userData) {
    return this.request("/auth/register", { method: "POST", body: userData, auth: false });
  }

  async login(credentials) {
    const data = await this.request("/auth/login", { method: "POST", body: credentials, auth: false });
    // If your backend returns { token, user }, persist the token here:
    if (data?.token) await this.setToken(data.token);
    return data;
  }

  async verifyToken() {
    // Usually requires auth
    return this.request("/auth/verify", { auth: true });
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST", auth: true });
    } finally {
      await this.setToken(null);
    }
  }

  // ---------- User endpoints ----------
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

  async uploadAvatar(imageUri) {
    const formData = new FormData();
    formData.append("avatar", {
      uri: imageUri,
      type: "image/jpeg",
      name: "avatar.jpg",
    });
    return this.request("/users/avatar", { method: "POST", body: formData, isFormData: true, auth: true });
  }

  async setOnlineStatus(isOnline) {
    return this.request("/users/online", { method: "POST", body: { isOnline }, auth: true });
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
    return this.request("/statuses/text", { method: "POST", body: { content }, auth: true });
  }

  async createMediaStatus(imageUri, content = "") {
    const formData = new FormData();
    formData.append("media", {
      uri: imageUri,
      type: "image/jpeg",
      name: "status.jpg",
    });
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
