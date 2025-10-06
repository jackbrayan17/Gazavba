import React from "react";
import { View, Text, FlatList, Image, TouchableOpacity, StatusBar } from "react-native";
import { useRouter } from "expo-router";

const chats = [
  { id: "1", name: "Brenda", message: "Hey! How’s Gazavba going?", time: "10:12", image: "https://i.pravatar.cc/150?img=3" },
  { id: "2", name: "Marcus", message: "Let’s meet at 4PM!", time: "09:34", image: "https://i.pravatar.cc/150?img=5" },
  { id: "3", name: "Elena", message: "🔥🔥🔥", time: "Yesterday", image: "https://i.pravatar.cc/150?img=2" },
];

export default function ChatListScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "white", paddingTop: StatusBar.currentHeight || 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", paddingHorizontal: 20, paddingVertical: 10 }}>
        Recent Chats
      </Text>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`(tabs)/chat/${item.id}`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderBottomWidth: 0.3,
              borderBottomColor: "#ddd",
            }}
          >
            <Image source={{ uri: item.image }} style={{ width: 55, height: 55, borderRadius: 27.5, marginRight: 15 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold", fontSize: 16 }}>{item.name}</Text>
              <Text style={{ color: "gray", marginTop: 2 }}>{item.message}</Text>
            </View>
            <Text style={{ color: "gray", fontSize: 12 }}>{item.time}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
