// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import SocketService from '../services/socket';

const normalizePhone = (value) => (value ?? '').replace(/[^\d+]/g, '').trim();
const normalizeEmail = (value) => (value ?? '').trim().toLowerCase();

const TOKEN_KEY = 'auth_token';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Boot: load token, verify session, connect socket
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          setToken(stored);
          ApiService.setToken(stored);
          const res = await ApiService.verifyToken(); // expects { user: {...} } when valid
          if (res && res.user) {
            setUser(res.user);
            setIsOnline(true);
            SocketService.connect(stored, res.user.id);
          }
        }
      } catch (_error) {
        // invalid token or network error → clean state
        await AsyncStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setToken(null);
        setIsOnline(false);
        ApiService.setToken(null);
        SocketService.disconnect();
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  const commonLoginSideEffects = async (u, t) => {
    await AsyncStorage.setItem(TOKEN_KEY, t);
    setUser(u);
    setToken(t);
    ApiService.setToken(t);
    SocketService.connect(t, u.id);
    try {
      await ApiService.setOnlineStatus(true);
      setIsOnline(true);
    } catch {}
  };

  const login = async (credentials) => {
    try {
      const payload = { ...credentials };
      if (payload.phone) {
        payload.phone = normalizePhone(payload.phone);
      }
      if (payload.email) {
        payload.email = normalizeEmail(payload.email);
      }
      if (payload.identifier && !payload.identifier.includes('@')) {
        payload.identifier = normalizePhone(payload.identifier);
      }

      const res = await ApiService.login(payload); // expects { user, token }
      const u = res?.user;
      const t = res?.token;
      if (!t) throw new Error('No token in response');
      await commonLoginSideEffects(u, t);
      return { success: true, user: u };
    } catch (e) {
      return { success: false, error: e?.message ?? 'Login failed' };
    }
  };

  // Handle backends that don't return token on /register → fallback to login
  const register = async (userData) => {
    try {
      const payload = {
        ...userData,
        name: userData?.name?.trim() ?? '',
        phone: normalizePhone(userData?.phone),
        email: userData?.email ? normalizeEmail(userData.email) : undefined,
      };

      if (!payload.phone) {
        return { success: false, error: 'Phone number is required' };
      }

      const res = await ApiService.register(payload); // may or may not include token
      const u = res?.user;
      const t = res?.token;

      if (t) {
        await commonLoginSideEffects(u, t);
        return { success: true, user: u };
      }

      // no token? try immediate login with provided creds
      const { phone, password } = payload;
      if (!phone || !password) {
        return { success: false, error: 'Registered. Please sign in.' };
      }

      const res2 = await ApiService.login({ phone, password });
      const u2 = res2?.user;
      const t2 = res2?.token;
      if (!t2) throw new Error('No token after register+login');

      await commonLoginSideEffects(u2, t2);
      return { success: true, user: u2 };
    } catch (e) {
      return { success: false, error: e?.message ?? 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await ApiService.logout();
        await ApiService.setOnlineStatus(false);
      }
    } catch {}
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setIsOnline(false);
    ApiService.setToken(null);
    SocketService.disconnect();
  };

  const updateProfile = async (updates) => {
    try {
      const updated = await ApiService.updateProfile(updates);
      setUser(updated);
      return { success: true, user: updated };
    } catch (e) {
      return { success: false, error: e?.message ?? 'Update failed' };
    }
  };

  const uploadAvatar = async (uri) => {
    try {
      const res = await ApiService.uploadAvatar(uri);
      setUser((prev) => ({ ...prev, avatar: res.avatar }));
      return { success: true, avatar: res.avatar };
    } catch (e) {
      return { success: false, error: e?.message ?? 'Upload failed' };
    }
  };

  const setOnlineStatus = async (status) => {
    try {
      await ApiService.setOnlineStatus(status);
      setIsOnline(status);
      return { success: true };
    } catch (e) {
      return { success: false, error: e?.message ?? 'Status update failed' };
    }
  };

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
    [user, token, initialized, isOnline]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
