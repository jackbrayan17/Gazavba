import React from "react";
import { View, Text, Image, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileView() {
  return (
    <View style={{ flex: 1, backgroundColor: "#f8f8f8", paddingTop: StatusBar.currentHeight || 40, alignItems: "center" }}>
      <Image source={{ uri: "https://i.pravatar.cc/200" }} style={{ width: 120, height: 120, borderRadius: 60, marginTop: 20 }} />
      <Text style={{ fontSize: 22, fontWeight: "700", marginTop: 15 }}>Jack Brayan</Text>
      <Text style={{ color: "gray", marginBottom: 25 }}>Software Engineer • Yaoundé</Text>

      <View style={{ width: "90%", backgroundColor: "white", borderRadius: 15, padding: 20, elevation: 3 }}>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
          <Ionicons name="settings-outline" size={24} color="#25D366" />
          <Text style={{ marginLeft: 15, fontSize: 16 }}>Account Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
          <Ionicons name="notifications-outline" size={24} color="#25D366" />
          <Text style={{ marginLeft: 15, fontSize: 16 }}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="log-out-outline" size={24} color="red" />
          <Text style={{ marginLeft: 15, fontSize: 16, color: "red" }}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
