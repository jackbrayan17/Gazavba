import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const messagesData = [
  { id: '1', fromMe: false, text: 'Hey Jack! 👋' },
  { id: '2', fromMe: true, text: 'Yo Brenda! How’s Gazavba today?' },
  { id: '3', fromMe: false, text: 'It’s vibing 💚🔥' },
];

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(messagesData);

  const sendMessage = () => {
    if (message.trim()) {
      setMessages([...messages, { id: Date.now().toString(), fromMe: true, text: message }]);
      setMessage('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ECE5DD' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        backgroundColor: '#075E54',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" style={{ marginRight: 15 }} />
        </TouchableOpacity>
        <Image source={{ uri: `https://i.pravatar.cc/150?img=${id}` }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Chat {id}</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.fromMe ? 'flex-end' : 'flex-start',
              backgroundColor: item.fromMe ? '#DCF8C6' : 'white',
              marginVertical: 4,
              marginHorizontal: 10,
              padding: 10,
              borderRadius: 12,
              maxWidth: '80%',
              elevation: 1,
            }}
          >
            <Text style={{ fontSize: 16, color: '#111' }}>{item.text}</Text>
          </View>
        )}
      />

      {/* Input bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#fff',
        borderTopWidth: 0.3,
        borderColor: '#ccc',
      }}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message"
          style={{
            flex: 1,
            backgroundColor: '#f0f0f0',
            borderRadius: 25,
            paddingHorizontal: 15,
            paddingVertical: 8,
            fontSize: 16,
          }}
        />
        <TouchableOpacity onPress={sendMessage} style={{ marginLeft: 10 }}>
          <Ionicons name="send" size={22} color="#075E54" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
