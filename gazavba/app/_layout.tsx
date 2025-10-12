// app/_layout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import React, { createContext, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { getTheme, Theme } from "../src/constants/theme";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { ThemeProvider, useThemeController } from "../src/contexts/ThemeContext";

export const ThemeCtx = createContext<Theme>(getTheme("light"));

function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;
    const inAuth = segments[0] === "auth";
    if (!token && !inAuth) {
      router.replace("/auth/LoginScreen");
    } else if (token && inAuth) {
      router.replace("/(tabs)/ChatListScreen");
    }
  }, [segments, token, initialized, router]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

function ThemeBridge({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeController();
  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemeBridge>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="contacts/index" options={{ headerShown: true, headerTitle: "Contacts" }} />
              <Stack.Screen name="about" />
              <Stack.Screen name="auth/LoginScreen" />
              <Stack.Screen name="auth/RegisterScreen" />
            </Stack>
          </AuthGate>
        </ThemeBridge>
      </AuthProvider>
    </ThemeProvider>
  );
}
