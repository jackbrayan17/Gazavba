import React from 'react';
import { View, Text, Image, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

const messages = [
  { id: '1', text: 'Hey, how’s it going?', sender: 'Brenda' },
  { id: '2', text: 'All good! What about you?', sender: 'You' },
  { id: '3', text: '🔥🔥🔥', sender: 'Brenda' },
];

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, padding: 10, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>
        Chat with {id}
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
