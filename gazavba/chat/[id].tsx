import React, { useContext } from "react";
import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemeCtx } from "../app/_layout";
const messages = [
  { id: '1', text: 'Hey, how’s it going?', sender: 'Brenda' },
  { id: '2', text: 'All good! What about you?', sender: 'You' },
  { id: '3', text: '🔥🔥🔥', sender: 'Brenda' },
];

export default function ChatDetailScreen() {
  const { id, name, avatar } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const t = useContext(ThemeCtx);
  return (
    <View style={{ flex: 1, padding: 10, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>
        {avatar ? (
              <Image source={{ uri: String(avatar) }} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 10 }} />
            ) : (
              <Image source={require("../../assets/images/logo.png")} style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }} />
            )}
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              {name ? String(name) : `Chat ${id}`}
          </Text>
      </Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginVertical: 5 }}>
            <Text style={{ fontWeight: item.sender === 'You' ? 'bold' : 'normal' }}>
              {item.sender}: {item.text}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
