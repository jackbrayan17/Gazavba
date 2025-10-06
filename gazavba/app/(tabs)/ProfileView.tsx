import React, { useContext, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Image, TouchableOpacity, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ThemeCtx } from "../_layout";

export default function ProfileView() {
  const t = useContext(ThemeCtx);
  const router = useRouter();
  const [name, setName] = useState("Jack Brayan");
  const [edit, setEdit] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ alignItems: "center", paddingTop: 24, paddingBottom: 16 }}>
        <Image source={{ uri: "https://i.pravatar.cc/220?img=7" }} style={{ width: 120, height: 120, borderRadius: 60 }} />
        <Text style={{ fontSize: 22, fontWeight: "800", marginTop: 12, color: t.text }}>{name}</Text>
        <Text style={{ color: t.subtext, marginTop: 4 }}>+237 • Gazavba user</Text>
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: t.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.hairline }}>
        <TouchableOpacity onPress={() => setEdit(true)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="create-outline" size={22} color={t.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: t.text }}>Change name</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/contacts")} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="people-outline" size={22} color={t.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: t.text }}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/about")} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="information-circle-outline" size={22} color={t.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: t.text }}>About</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: t.card, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.hairline }}>
        <Ionicons name="log-out-outline" size={20} color="#E03131" />
        <Text style={{ marginLeft: 8, fontWeight: "700", color: "#E03131" }}>Logout</Text>
      </TouchableOpacity>

      {/* Edit Name modal */}
      <Modal visible={edit} transparent animationType="fade" onRequestClose={() => setEdit(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: t.card, borderRadius: 16, width: "86%", padding: 16, borderWidth: 1, borderColor: t.hairline }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: t.text, marginBottom: 10 }}>Change your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter name"
              placeholderTextColor={t.subtext}
              style={{ borderWidth: 1, borderColor: t.hairline, backgroundColor: "#F1F3F5", color: t.text, borderRadius: 12, padding: 12, fontSize: 16 }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 14 }}>
              <TouchableOpacity onPress={() => setEdit(false)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: t.subtext }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEdit(false)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: t.mint, fontWeight: "800" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
