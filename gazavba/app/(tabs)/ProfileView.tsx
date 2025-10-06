import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileView() {
  return (
    <View className="flex-1 bg-white items-center p-5">
      <Image
        source={{ uri: 'https://i.pravatar.cc/300?img=7' }}
        className="w-32 h-32 rounded-full mt-10"
      />
      <Text className="mt-5 text-2xl font-bold">Jack Brayan</Text>
      <Text className="text-gray-500 mt-1">+237 690 123 456</Text>

      <View className="w-full mt-10">
        <TouchableOpacity className="flex-row items-center p-3 border-b border-gray-200">
          <Ionicons name="person-circle-outline" size={24} color="gray" />
          <Text className="ml-3 text-base">About</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center p-3 border-b border-gray-200">
          <Ionicons name="settings-outline" size={24} color="gray" />
          <Text className="ml-3 text-base">Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center p-3">
          <Ionicons name="log-out-outline" size={24} color="red" />
          <Text className="ml-3 text-base text-red-500">Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
