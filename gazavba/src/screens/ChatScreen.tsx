import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

const chats = [
  { id: '1', name: 'Brenda', message: 'Hey, how’s Gazavba going?', time: '10:12', image: 'https://i.pravatar.cc/150?img=3' },
  { id: '2', name: 'Marcus', message: 'Let’s meet at 4PM!', time: '09:34', image: 'https://i.pravatar.cc/150?img=5' },
  { id: '3', name: 'Elena', message: '🔥🔥🔥', time: 'Yesterday', image: 'https://i.pravatar.cc/150?img=2' },
];

export default function ChatScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <FlatList
  data={chats}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/../chat/[id]',
          params: { id: item.id },
        })
      }
      className="flex-row items-center p-3 border-b border-gray-200"
    >
      <Image source={{ uri: item.image }} className="w-12 h-12 rounded-full mr-3" />
      <View className="flex-1">
        <Text className="font-bold text-lg">{item.name}</Text>
        <Text className="text-gray-500">{item.message}</Text>
      </View>
      <Text className="text-gray-400 text-xs">{item.time}</Text>
    </TouchableOpacity>
  )}
/>

    </View>
  );
}
