import React from "react";
import { View, Text, ScrollView, Image, StatusBar } from "react-native";

const statuses = [
  { id: 1, name: "Brenda", time: "Today, 08:45", image: "https://i.pravatar.cc/150?img=3" },
  { id: 2, name: "Marcus", time: "Yesterday, 22:00", image: "https://i.pravatar.cc/150?img=5" },
];

export default function StatusScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff", paddingTop: StatusBar.currentHeight || 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", margin: 20 }}>Status</Text>
      {statuses.map((status) => (
        <View key={status.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 15, paddingHorizontal: 20 }}>
          <Image source={{ uri: status.image }} style={{ width: 60, height: 60, borderRadius: 30, marginRight: 15 }} />
          <View>
            <Text style={{ fontWeight: "bold", fontSize: 16 }}>{status.name}</Text>
            <Text style={{ color: "gray" }}>{status.time}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
