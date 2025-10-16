import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ApiService from "../../src/services/api";
import SocketService from "../../src/services/socket";
import { useAuth } from "../../src/contexts/AuthContext";
import { ThemeCtx } from "../_layout";
import { useThemeController } from "../../src/contexts/ThemeContext";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";
import useMatchedContacts from "../../src/hooks/useMatchedContacts";

export type ChatListEntry = {
  id: string;
  displayName: string;
  avatar?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
  type?: string;
  participants?: any[];
  otherParticipant?: any | null;
};

const FALLBACK_AVATAR = "https://ui-avatars.com/api/?name=Gazavba&background=0C3B2E&color=fff";

const formatTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < 6 * oneDay) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function ChatListScreen() {
  const theme = useContext(ThemeCtx);
  const router = useRouter();
  const { user, token, initialized } = useAuth();
  const { mode, toggleTheme } = useThemeController();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatListEntry[]>([]);
  const [statusFeed, setStatusFeed] = useState<any[]>([]);
  const { matchIdSet, permissionState, refresh: refreshMatches } = useMatchedContacts(user?.id);
  const canViewContactStatuses = permissionState === "granted";

  const loadStatuses = useCallback(async () => {
    try {
      const data = await ApiService.getStatuses();
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter((item: any) => {
        if (item.userId === user?.id) return true;
        if (!canViewContactStatuses) return false;
        return matchIdSet.has(item.userId);
      });
      setStatusFeed(filtered);
    } catch (err) {
      console.error("Failed to load statuses", err);
    }
  }, [canViewContactStatuses, matchIdSet, user?.id]);

  const loadChats = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await ApiService.getChats();
      setChats(Array.isArray(response) ? response : []);
      await loadStatuses();
    } catch (err: any) {
      const message = err?.message || "Unable to load conversations";
      setError(message);
      if (/unauthorized|401|Access token required/i.test(message)) {
        router.replace("/auth/LoginScreen");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router, loadStatuses]);

  useEffect(() => {
    if (!initialized) return;
    if (!token) {
      router.replace("/auth/LoginScreen");
      return;
    }
    loadChats();
  }, [initialized, token, loadChats, router]);

  useEffect(() => {
    const handleIncoming = ({ chatId, message }: { chatId: string; message: any }) => {
      setChats((prev) => {
        const existing = prev.find((item) => item.id === chatId);
        if (!existing) {
          loadChats();
          return prev;
        }
        const next = prev.map((item) => {
          if (item.id !== chatId) return item;
          return {
            ...item,
            lastMessage: message?.text ?? message?.content ?? item.lastMessage,
            lastMessageTime: message?.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString(),
            unreadCount: (item.unreadCount || 0) + (message?.senderId !== user?.id ? 1 : 0),
          };
        });
        next.sort((a, b) => {
          const timeA = new Date(a.lastMessageTime || 0).getTime();
          const timeB = new Date(b.lastMessageTime || 0).getTime();
          return timeB - timeA;
        });
        return next;
      });
    };

    const handleSent = (message: any) => {
      if (!message?.chatId) return;
      setChats((prev) =>
        prev.map((item) =>
          item.id === message.chatId
            ? {
                ...item,
                lastMessage: message.text ?? item.lastMessage,
                lastMessageTime: message.timestamp ? new Date(message.timestamp).toISOString() : new Date().toISOString(),
              }
            : item
        )
      );
    };

    SocketService.on("new_message", handleIncoming);
    SocketService.on("message_sent", handleSent);

    return () => {
      SocketService.off("new_message", handleIncoming);
      SocketService.off("message_sent", handleSent);
    };
  }, [loadChats, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (canViewContactStatuses) {
      await refreshMatches();
    }
    await loadChats();
    setRefreshing(false);
  }, [canViewContactStatuses, loadChats, refreshMatches]);

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const term = search.trim().toLowerCase();
    return chats.filter((item) =>
      item.displayName?.toLowerCase().includes(term) || item.lastMessage?.toLowerCase().includes(term)
    );
  }, [chats, search]);

  const statusMeta = useMemo(() => {
    const meta: Record<string, { unseen: number; total: number }> = {};
    statusFeed.forEach((item: any) => {
      const key = item.userId;
      if (!key || key === user?.id) return;
      const entry = meta[key] ?? { unseen: 0, total: 0 };
      entry.total += 1;
      if (!item.hasViewed) {
        entry.unseen += 1;
      }
      meta[key] = entry;
    });
    return meta;
  }, [statusFeed, user?.id]);

  const openChat = (chat: ChatListEntry) => {
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: chat.id,
      },
    });
  };

  const renderItem = ({ item }: { item: ChatListEntry }) => {
    const avatarUri = resolveAssetUri(item.avatar) || FALLBACK_AVATAR;
    const otherId = item.otherParticipant?.id || item.otherParticipant?.userId;
    const statusInfo = otherId ? statusMeta[otherId] : undefined;
    const showStatusRing = !!statusInfo?.unseen;
    return (
      <TouchableOpacity
        onPress={() => openChat(item)}
        activeOpacity={0.85}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}
      >
        <View style={styles.avatarWrapper}>
          <View
            style={{
              width: showStatusRing ? 68 : 60,
              height: showStatusRing ? 68 : 60,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showStatusRing && (
              <View
                style={{
                  position: "absolute",
                  width: 66,
                  height: 66,
                  borderRadius: 33,
                  borderWidth: 3,
                  borderColor: theme.mint,
                }}
              />
            )}
            <Image
              source={{ uri: avatarUri }}
              style={[
                styles.avatar,
                showStatusRing && { width: 56, height: 56, borderRadius: 28 },
              ]}
            />
          </View>
          {item.otherParticipant?.isOnline && <View style={[styles.onlineDot, { borderColor: theme.card }]} />}
        </View>
        <View style={styles.content}>
          <View style={styles.rowBetween}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={[styles.time, { color: theme.subtext }]}>{formatTimestamp(item.lastMessageTime)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={[styles.preview, { color: theme.subtext }]} numberOfLines={1}>
              {item.lastMessage || "Tap to start chatting"}
            </Text>
            {item.unreadCount ? (
              <View style={[styles.badge, { backgroundColor: theme.mint }]}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!initialized || isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg, padding: 24 }]}>
        <Text style={{ color: theme.text, marginBottom: 12, textAlign: "center" }}>{error}</Text>
        <TouchableOpacity onPress={loadChats} style={[styles.retryButton, { backgroundColor: theme.primary }]}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={{ color: theme.subtext, textTransform: "uppercase", fontSize: 12 }}>Conversations</Text>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>Gazavba</Text>
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            accessibilityLabel="Toggle theme"
            style={[styles.themeToggle, { borderColor: theme.hairline, backgroundColor: theme.card }]}
          >
            <Ionicons name={mode === "dark" ? "sunny" : "moon"} size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Ionicons name="search" size={18} color={theme.subtext} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search chats"
            placeholderTextColor={theme.subtext}
            style={[styles.searchInput, { color: theme.text }]}
          />
          <TouchableOpacity onPress={() => router.push("/contacts")}>
            <Ionicons name="person-add" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={[styles.center, { padding: 32 }]}>
            <Ionicons name="chatbubble-ellipses" size={42} color={theme.subtext} />
            <Text style={{ color: theme.text, fontWeight: "700", marginTop: 12 }}>No conversations yet</Text>
            <Text style={{ color: theme.subtext, marginTop: 4, textAlign: "center" }}>
              Start by inviting your contacts or searching for teammates.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        onPress={() => router.push("/contacts")}
        style={[styles.fab, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
        activeOpacity={0.9}
      >
        <Ionicons name="create" size={22} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatarWrapper: {
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2ECC71",
    borderWidth: 2,
  },
  content: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
  },
  preview: {
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  badge: {
    minWidth: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
