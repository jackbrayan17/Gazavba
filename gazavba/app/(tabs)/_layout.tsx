import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext } from "react";
import { ThemeCtx } from "../_layout";
import AppHeader from "../components/AppHeader";

export default function TabsLayout() {
  const t = useContext(ThemeCtx);

  return (
     <Tabs
      screenOptions={{
        // Affiche un header commun stylé
        headerShown: true,
        headerTitle: () => <AppHeader />,        // logo + Gazavba
        headerStyle: { backgroundColor: t.primary },
        headerTintColor: "#fff",
        tabBarActiveTintColor: t.tabActive,
        tabBarInactiveTintColor: t.tabInactive,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.hairline, borderTopWidth: 0.5 },
        tabBarLabelStyle: { fontWeight: "600" }
      }}
    >
      <Tabs.Screen
        name="ChatListScreen"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="StatusScreen"
        options={{
          title: "Status",
          tabBarIcon: ({ color, size }) => <Ionicons name="aperture" color={color} size={size} />
        }}
      />{/* Masquer ces routes des onglets */}
  <Tabs.Screen name="chat" options={{ href: null }} />
  <Tabs.Screen name="ChatDetailScreen" options={{ href: null }} />
      <Tabs.Screen
        name="ProfileView"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} />
        }}
      />
    </Tabs>
    
  );
}
