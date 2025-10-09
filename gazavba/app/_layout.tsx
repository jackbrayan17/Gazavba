// app/_layout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import React, { createContext, useEffect, useMemo } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { getTheme, Theme } from "../src/constants/theme";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";

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
  }, [segments, token, initialized]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);

  return (
    <AuthProvider>
      <ThemeCtx.Provider value={theme}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="contacts/index" options={{ headerShown: true, headerTitle: "Contacts" }} />
            <Stack.Screen name="about" />
            <Stack.Screen name="auth/LoginScreen" />
            <Stack.Screen name="auth/RegisterScreen" />
          </Stack>
        </AuthGate>
      </ThemeCtx.Provider>
    </AuthProvider>
  );
}
