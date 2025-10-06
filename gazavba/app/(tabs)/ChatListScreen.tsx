import React, { useContext, useMemo, useRef, useState, useEffect } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, RefreshControl, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ThemeCtx } from "../_layout";

type ChatItem = { id: string; name: string; last: string; time: string; avatar: string };

const seed: ChatItem[] = [
  { id: "1", name: "Brenda", last: "Hey! How’s Gazavba?", time: "10:12", avatar: "https://i.pravatar.cc/120?img=3" },
  { id: "2", name: "Marcus", last: "Let’s meet at 4PM!", time: "09:34", avatar: "https://i.pravatar.cc/120?img=5" },
  { id: "3", name: "Elena",  last: "🔥🔥🔥",              time: "Yesterday", avatar: "https://i.pravatar.cc/120?img=2" }
];

export default function ChatListScreen() {
  const t = useContext(ThemeCtx);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState(seed);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
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
              <Image source={{ uri: item.avatar }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: t.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: t.subtext }}>{item.time}</Text>
                </View>
                <Text numberOfLines={1} style={{ color: t.subtext, marginTop: 2 }}>{item.last}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
