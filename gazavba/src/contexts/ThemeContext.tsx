import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { getTheme, Theme } from '../constants/theme';

export type ThemeMode = 'light' | 'dark';

type ThemeController = {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = 'theme_mode';
const defaultScheme: ColorSchemeName = Appearance.getColorScheme();
const initialMode: ThemeMode = defaultScheme === 'dark' ? 'dark' : 'light';

const ThemeControllerContext = createContext<ThemeController>({
  theme: getTheme(initialMode),
  mode: initialMode,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [theme, setTheme] = useState<Theme>(getTheme(initialMode));
  const [hydrated, setHydrated] = useState(false);

  const applyMode = async (nextMode: ThemeMode, persist = true) => {
    setMode(nextMode);
    setTheme(getTheme(nextMode));
    if (persist) {
      await AsyncStorage.setItem(STORAGE_KEY, nextMode);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          await applyMode(stored as ThemeMode, false);
        }
      } catch {
        // ignore storage errors
      } finally {
        setHydrated(true);
      }
    })();

    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      if (!hydrated) return;
      // Only auto-update when user hasn't set an explicit preference yet
      AsyncStorage.getItem(STORAGE_KEY).then((value) => {
        if (value !== 'light' && value !== 'dark') {
          const schemeMode: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light';
          applyMode(schemeMode, false);
        }
      });
    });

    return () => listener.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    applyMode(nextMode).catch(() => {});
  }, [mode]);

  const setThemeMode = useCallback((nextMode: ThemeMode) => {
    applyMode(nextMode).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      theme,
      mode,
      toggleTheme,
      setThemeMode,
    }),
    [theme, mode, toggleTheme, setThemeMode]
  );

  return (
    <ThemeControllerContext.Provider value={value}>{children}</ThemeControllerContext.Provider>
  );
};

export const useThemeController = () => {
  const ctx = useContext(ThemeControllerContext);
  if (!ctx) {
    throw new Error('useThemeController must be used within a ThemeProvider');
  }
  return ctx;
};
