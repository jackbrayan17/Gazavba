import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useContext } from "react";
import { ThemeCtx } from "../_layout";
import AppHeader from "../components/AppHeader";
import useSocketNotifications from "../../src/hooks/useSocketNotifications";
import NotificationService from "../../src/services/notificationService";
import ApiService from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";

export default function TabsLayout() {
  const t = useContext(ThemeCtx);
  const { token } = useAuth();

  useSocketNotifications();

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const syncBadge = async () => {
        try {
          if (!token) return;
          const chats = await ApiService.getChats();
          if (!mounted) return;
          const total = Array.isArray(chats)
            ? chats.reduce((sum, chat) => sum + (Number(chat.unreadCount) || 0), 0)
            : 0;
          NotificationService.setAppBadge(total);
          NotificationService.syncMuted(Array.isArray(chats) ? chats : []);
        } catch (error) {
          console.error("Failed to sync badge", error);
        }
      };

      syncBadge();
      return () => {
        mounted = false;
      };
    }, [token])
  );

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
            <Ionicons name="chatbubbles" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="StatusScreen"
        options={{
          title: "Status",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="aperture" color={color} size={size} />
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
