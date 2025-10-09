// app/(tabs)/ChatListScreen.tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import api from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";

type ChatItem = {
  id: number | string;
  title?: string;
  name?: string;
  lastMessage?: string;
};

export default function ChatListScreen() {
  const router = useRouter();
  const { token, initialized } = useAuth();
  const [data, setData] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = async () => {
    try {
      setErr(null);
      setLoading(true);
      const res = await api.getChats();
      setData(Array.isArray(res) ? res : []);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setErr(msg);
      if (/unauthorized|401|access token required/i.test(msg)) {
        router.replace("/auth/LoginScreen");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialized) return;           // wait until token is loaded/checked
    if (!token) {
      router.replace("/auth/LoginScreen");
      return;
    }
    loadChats();
  }, [initialized, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  if (!initialized || loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ marginBottom: 8 }}>{err}</Text>
        <Text onPress={loadChats} style={{ color: "dodgerblue" }}>Retry</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
          <Text style={{ fontWeight: "600" }}>{item.title ?? item.name ?? `Chat ${item.id}`}</Text>
          {!!item.lastMessage && <Text numberOfLines={1} style={{ color: "#666" }}>{item.lastMessage}</Text>}
        </View>
      )}
    />
  );
}
