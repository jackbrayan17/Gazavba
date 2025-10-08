import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, RefreshControl, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { chats as chatSummaries, getUserById } from "../../src/data/mockData";
import { ThemeCtx } from "../_layout";

type ListItem = {
  id: string;
  name: string;
  last: string;
  time: string;
  avatar: string;
  isOnline: boolean;
  unreadCount: number;
};

export default function ChatListScreen() {
  const t = useContext(ThemeCtx);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<ListItem[]>([]);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    // hydrate list from shared data
    const mapped = chatSummaries.map(s => {
      const u = getUserById(s.userId)!;
      return {
        id: s.id,
        name: u.name,
        last: s.last,
        time: s.time,
        avatar: u.avatar,
        isOnline: u.isOnline,
        unreadCount: s.unreadCount
      } as ListItem;
    });
    setChats(mapped);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(c => c.name.toLowerCase().includes(q) || c.last.toLowerCase().includes(q));
  }, [query, chats]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View style={{ opacity: fade }}>
        {/* Title + Search */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: t.primary, marginBottom: 10 }}>Gazavba</Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.hairline, paddingHorizontal: 12, height: 44 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={t.subtext}
              style={{ flex: 1, color: t.text, fontSize: 16 }}
            />
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.mint} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.hairline, marginLeft: 76 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.name, avatar: item.avatar }})}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
            >
              <View>
                <Image source={{ uri: item.avatar }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
                {item.isOnline && (
                  <View style={{ position: "absolute", right: 2, bottom: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#2ECC71", borderWidth: 2, borderColor: "#fff" }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: item.unreadCount > 0 ? "800" : "700", color: t.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: t.subtext }}>{item.time}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: item.unreadCount > 0 ? t.text : t.subtext, fontWeight: item.unreadCount > 0 ? "700" : "400" }}>{item.last}</Text>
                  {item.unreadCount > 0 && (
                    <View style={{ marginLeft: 8, backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Floating Action Button to Contacts (just above tabs) */}
        <TouchableOpacity
          onPress={() => router.push("/contacts")}
          style={{ position: "absolute", right: 20, bottom: 12, backgroundColor: t.accent, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
        >
          <Ionicons name="people" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}
