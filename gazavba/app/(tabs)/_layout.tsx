import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useContext } from "react";
import { getUnreadChatsCount, getUnseenStatusCount } from "../../src/data/mockData";
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
          tabBarIcon: ({ color, size }) => (
            <BadgeIcon count={getUnreadChatsCount()}>
              <Ionicons name="chatbubbles" color={color} size={size} />
            </BadgeIcon>
          )
        }}
      />
      <Tabs.Screen
        name="StatusScreen"
        options={{
          title: "Status",
          tabBarIcon: ({ color, size }) => (
            <BadgeIcon count={getUnseenStatusCount()}>
              <Ionicons name="aperture" color={color} size={size} />
            </BadgeIcon>
          )
        }}
      />{/* Masquer ces routes des onglets */}
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

function BadgeIcon({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <>
      <>{children}</>
      {count > 0 && (
        <>
          {/* small red dot/badge overlay is handled by tab bar; here we simply stack markup */}
        </>
      )}
    </>
  );
}
