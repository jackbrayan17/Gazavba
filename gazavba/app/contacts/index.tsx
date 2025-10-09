import { useRouter } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import ApiService from "../../src/services/api";
import { ThemeCtx } from "../_layout";

export default function ContactsScreen() {
  const t = useContext(ThemeCtx);
  const router = useRouter();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const users = await ApiService.getUsers();
      // Filter out current user
      const filteredUsers = users.filter(u => u.id !== user?.id);
      setContacts(filteredUsers);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchContacts = async (query) => {
    if (!query.trim()) {
      loadContacts();
      return;
    }
    
    try {
      const results = await ApiService.searchUsers(query);
      const filteredResults = results.filter(u => u.id !== user?.id);
      setContacts(filteredResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleContactPress = async (contact) => {
    try {
      // Create or get direct chat with this contact
      const chat = await ApiService.createChat({
        type: 'direct',
        participants: [contact.id]
      });
      
      router.push({ 
        pathname: "/chat/[id]", 
        params: { 
          id: chat.id, 
          name: contact.name, 
          avatar: contact.avatar 
        }
      });
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.primary, marginBottom: 12 }}>Contacts</Text>
        
        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.hairline, paddingHorizontal: 12, height: 44, marginBottom: 16 }}>
          <Ionicons name="search" size={18} color={t.subtext} />
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchContacts(text);
            }}
            placeholder="Search contacts"
            placeholderTextColor={t.subtext}
            style={{ flex: 1, color: t.text, fontSize: 16, marginLeft: 8 }}
          />
        </View>

        <FlatList
          data={contacts}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleContactPress(item)}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 12 }}
            >
              <Image source={{ uri: item.avatar }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
              <View>
                <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>{item.name}</Text>
                <Text style={{ color: t.subtext, marginTop: 2 }}>{item.isOnline ? "Online" : "Offline"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
