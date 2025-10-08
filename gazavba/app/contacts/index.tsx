import { useRouter } from "expo-router";
import React, { useContext } from "react";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { users } from "../../src/data/mockData";
import { ThemeCtx } from "../_layout";

export default function ContactsScreen() {
  const t = useContext(ThemeCtx);
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.primary, marginBottom: 12 }}>Contacts</Text>
        <FlatList
          data={users}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: item.name, avatar: item.avatar }})}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 12 }}
            >
              <Image source={{ uri: item.avatar }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
              <View>
                <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>{item.name}</Text>
                <Text style={{ color: t.subtext, marginTop: 2 }}>{item.isOnline ? "Online" : "Offline"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
