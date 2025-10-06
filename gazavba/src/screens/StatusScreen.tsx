import React from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';

const statuses = [
  { id: '1', name: 'You', image: 'https://i.pravatar.cc/150?img=1', time: 'Just now' },
  { id: '2', name: 'Marcus', image: 'https://i.pravatar.cc/150?img=4', time: 'Today, 9:00 AM' },
  { id: '3', name: 'Brenda', image: 'https://i.pravatar.cc/150?img=6', time: 'Yesterday, 8:00 PM' },
];

export default function StatusScreen() {
  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={statuses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity className="flex-row items-center p-3 border-b border-gray-200">
            <Image source={{ uri: item.image }} className="w-14 h-14 rounded-full border-2 border-green-500 mr-3" />
            <View>
              <Text className="font-bold text-lg">{item.name}</Text>
              <Text className="text-gray-500 text-sm">{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
