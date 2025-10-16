// src/contexts/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import ApiService from "../services/api";
import SocketService from "../services/socket"; // supposé existant

const LOG_TAG = "[AuthContext]";

const normalizePhone = (value) => (value ?? "").replace(/[^\d+]/g, "").trim();
const normalizeEmail = (value) => (value ?? "").trim().toLowerCase();

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

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Boot: charge le token via ApiService (SecureStore/localStorage), vérifie la session, ouvre le socket
  useEffect(() => {
    (async () => {
      try {
        console.log(`${LOG_TAG} bootstrapping session`);
        await ApiService.init(); // charge le token persistant
        if (ApiService.token) {
          setToken(ApiService.token);
          console.log(`${LOG_TAG} verifying persisted token`);
          const res = await ApiService.verifyToken(); // doit renvoyer { user }
          if (res?.user) {
            setUser(res.user);
            setIsOnline(true);
            SocketService.connect(ApiService.token, res.user.id);
          }
        }
      } catch (_error) {
        console.warn(`${LOG_TAG} bootstrap failed`, _error);
        // token invalide / réseau KO → on nettoie local
        await ApiService.setToken(null);
        setUser(null);
        setToken(null);
        setIsOnline(false);
        SocketService.disconnect();
      } finally {
        setInitialized(true);
        console.log(`${LOG_TAG} bootstrap finished`);
      }
    })();
  }, []);

  const commonLoginSideEffects = useCallback(async (u, t) => {
    await ApiService.setToken(t); // persiste via SecureStore ou localStorage (web)
    setUser(u);
    setToken(t);
    SocketService.connect(t, u.id);
    try {
      await ApiService.setOnlineStatus(true);
      setIsOnline(true);
      console.log(`${LOG_TAG} online status set to true`);
    } catch (err) {
      console.warn(`${LOG_TAG} failed to set online status`, err?.message || err);
    }
  }, []);

  const login = useCallback(
    async (credentials) => {
      try {
        const payload = { ...credentials };
        if (payload.phone) payload.phone = normalizePhone(payload.phone);
        if (payload.email) payload.email = normalizeEmail(payload.email);
        if (payload.identifier && !payload.identifier.includes("@")) {
          payload.identifier = normalizePhone(payload.identifier);
        }

        console.log(`${LOG_TAG} login attempt`, sanitizeForLog(payload));
        const res = await ApiService.login(payload); // { user, token }
        const u = res?.user;
        const t = res?.token;
        if (!t) throw new Error("No token in response");
        await commonLoginSideEffects(u, t);
        console.log(`${LOG_TAG} login success`, { userId: u?.id, hasToken: !!t });
        return { success: true, user: u };
      } catch (e) {
        console.error(`${LOG_TAG} login failed`, e);
        return { success: false, error: e?.message ?? "Login failed" };
      }
    },
    [commonLoginSideEffects]
  );

  // Register (si le backend ne renvoie pas de token, fallback sur login)
  const register = useCallback(
    async (userData) => {
      try {
        const payload = {
          ...userData,
          name: userData?.name?.trim() ?? "",
          phone: normalizePhone(userData?.phone),
          email: userData?.email ? normalizeEmail(userData.email) : undefined,
        };

        if (!payload.phone) {
          return { success: false, error: "Phone number is required" };
        }

        console.log(`${LOG_TAG} register attempt`, sanitizeForLog(payload));
        const res = await ApiService.register(payload); // peut renvoyer { user, token } ou non
        const u = res?.user;
        const t = res?.token;

        if (t) {
          await commonLoginSideEffects(u, t);
          console.log(`${LOG_TAG} register success with token`, { userId: u?.id });
          return { success: true, user: u };
        }

        // Pas de token? Tentative de login immédiat avec phone/password
        const { phone, password } = payload;
        if (!phone || !password) {
          return { success: false, error: "Registered. Please sign in." };
        }

        const res2 = await ApiService.login({ phone, password });
        const u2 = res2?.user;
        const t2 = res2?.token;
        if (!t2) throw new Error("No token after register+login");

        await commonLoginSideEffects(u2, t2);
        console.log(`${LOG_TAG} register fallback login success`, { userId: u2?.id });
        return { success: true, user: u2 };
      } catch (e) {
        console.error(`${LOG_TAG} register failed`, e);
        return { success: false, error: e?.message ?? "Registration failed" };
      }
    },
    [commonLoginSideEffects]
  );

  const logout = useCallback(async () => {
    try {
      console.log(`${LOG_TAG} logout requested`);
      if (token) {
        await ApiService.logout();
        await ApiService.setOnlineStatus(false);
      }
    } catch {}
    await ApiService.setToken(null);
    setUser(null);
    setToken(null);
    setIsOnline(false);
    SocketService.disconnect();
    console.log(`${LOG_TAG} logout completed`);
  }, [token]);

  const updateProfile = useCallback(async (updates) => {
    try {
      const updated = await ApiService.updateProfile(updates);
      setUser(updated);
      return { success: true, user: updated };
    } catch (e) {
      return { success: false, error: e?.message ?? "Update failed" };
    }
  }, []);

  const uploadAvatar = useCallback(async (uri) => {
    try {
      const res = await ApiService.uploadAvatar(uri);
      setUser((prev) => ({ ...prev, avatar: res.avatar }));
      return { success: true, avatar: res.avatar };
    } catch (e) {
      return { success: false, error: e?.message ?? "Upload failed" };
    }
  }, []);

  const setOnlineStatus = useCallback(async (status) => {
    try {
      await ApiService.setOnlineStatus(status);
      setIsOnline(status);
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message ?? "Status update failed" };
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      initialized,
      isOnline,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
      setOnlineStatus,
    }),
    [
      user,
      token,
      initialized,
      isOnline,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
      setOnlineStatus,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
