import { Stack } from "expo-router";
import React, { createContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { getTheme, Theme } from "../src/constants/theme";

export const ThemeCtx = createContext<Theme>(getTheme("light"));

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);

  return (
    <ThemeCtx.Provider value={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="contacts/index" options={{ headerShown: true, headerTitle: "Contacts" }} />
        <Stack.Screen name="about" />
        <Stack.Screen name="auth/LoginScreen" />
        <Stack.Screen name="auth/RegisterScreen" />
      </Stack>
    </ThemeCtx.Provider>
  );
}
