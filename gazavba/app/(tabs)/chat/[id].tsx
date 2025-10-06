import React, { useState } from "react";
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StatusBar, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const [menuVisible, setMenuVisible] = useState(false);
  const [message, setMessage] = useState("");

  const messages = [
    { id: "1", text: "Hey, how are you?", sender: "them" },
    { id: "2", text: "I’m doing great! Working on Gazavba 🚀", sender: "me" },
    { id: "3", text: "That’s awesome bro!", sender: "them" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5", paddingTop: StatusBar.currentHeight || 40 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingBottom: 10, backgroundColor: "#25D366" }}>
        <Image source={require("../../../assets/images/logo.png")} style={{ width: 35, height: 35, borderRadius: 20 }} />
        <Text style={{ fontSize: 18, fontWeight: "700", color: "white" }}>Chat {id}</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)" }}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={{ position: "absolute", top: 80, right: 20, backgroundColor: "white", borderRadius: 10, elevation: 5, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3 }}>
            <TouchableOpacity style={{ padding: 15 }}><Text>Settings</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 15 }}><Text>About Us</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.sender === "me" ? "flex-end" : "flex-start",
              backgroundColor: item.sender === "me" ? "#DCF8C6" : "white",
              marginHorizontal: 10,
              marginVertical: 4,
              padding: 10,
              borderRadius: 10,
              maxWidth: "75%",
            }}
          >
            <Text>{item.text}</Text>
          </View>
        )}
      />

      {/* Input */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "white", padding: 10 }}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          style={{ flex: 1, paddingHorizontal: 15, backgroundColor: "#f0f0f0", borderRadius: 25 }}
        />
        <TouchableOpacity style={{ marginLeft: 10 }}>
          <Ionicons name="send" size={24} color="#25D366" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
