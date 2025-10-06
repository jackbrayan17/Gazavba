import React, { useContext } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, FlatList, Image } from "react-native";
import { ThemeCtx } from "../_layout";

const contacts = [
  { id: "c1", name: "Brenda", phone: "+237 6xx xxx xxx", avatar: "https://i.pravatar.cc/120?img=3" },
  { id: "c2", name: "Marcus", phone: "+237 6xx xxx xxx", avatar: "https://i.pravatar.cc/120?img=5" },
  { id: "c3", name: "Elena",  phone: "+237 6xx xxx xxx", avatar: "https://i.pravatar.cc/120?img=2" }
];

export default function ContactsScreen() {
  const t = useContext(ThemeCtx);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.primary, marginBottom: 12 }}>Contacts</Text>
        <FlatList
          data={contacts}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 12 }}>
              <Image source={{ uri: item.avatar }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
              <View>
                <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>{item.name}</Text>
                <Text style={{ color: t.subtext, marginTop: 2 }}>{item.phone}</Text>
              </View>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
