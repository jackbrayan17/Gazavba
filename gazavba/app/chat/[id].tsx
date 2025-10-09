import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";
import ApiService from "../../src/services/api";
import SocketService from "../../src/services/socket";
import { ThemeCtx } from "../_layout";

type Msg = { id: string; me: boolean; text: string };

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useContext(ThemeCtx);
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<Msg[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const menuScale = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (id) {
      loadChatData();
      setupSocketListeners();
    }
    
    return () => {
      SocketService.removeAllListeners();
    };
  }, [id]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      const [chatData, messages] = await Promise.all([
        ApiService.getChat(id!),
        ApiService.getMessages(id!)
      ]);
      
      setChat(chatData);
      const formattedMessages = messages.map(m => ({
        id: m.id,
        me: m.senderId === user?.id,
        text: m.text,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar
      }));
      setData(formattedMessages);
      
      // Mark chat as read
      await ApiService.markChatAsRead(id!);
    } catch (error) {
      console.error('Failed to load chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    SocketService.onNewMessage((messageData) => {
      if (messageData.chatId === id) {
        const newMessage = {
          id: messageData.message.id,
          me: messageData.message.senderId === user?.id,
          text: messageData.message.text,
          senderName: messageData.message.senderName,
          senderAvatar: messageData.message.senderAvatar
        };
        setData(prev => [...prev, newMessage]);
      }
    });
  };

  const toggleMenu = () => {
    setOpen((v) => {
      const next = !v;
      Animated.timing(menuScale, {
        toValue: next ? 1 : 0,
        duration: 160,
        easing: next ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true
      }).start();
      return next;
    });
  };

  const menuStyle = useMemo(() => ([
    {
      transform: [
        { scale: menuScale.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
        { translateY: menuScale.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }
      ],
      opacity: menuScale
    }
  ]), [menuScale]);

  const send = async () => {
    const text = msg.trim();
    if (!text || !id || !user) return;
    
    try {
      // Send via Socket.IO for real-time delivery
      SocketService.sendMessage(id, user.id, text);
      
      // Also send via API as backup
      await ApiService.sendMessage({
        chatId: id,
        text,
        messageType: 'text'
      });
      
      setMsg("");
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View style={{ transform: [{ translateY: enter.interpolate({ inputRange: [0,1], outputRange: [6,0] }) }], opacity: enter }}>
        {/* Header with back, avatar, name, online */}
        <View style={{ backgroundColor: t.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8, padding: 6 }}>
              <Ionicons name="chevron-back" color="#fff" size={22} />
            </TouchableOpacity>
            {chat && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View>
                  <Image source={{ uri: chat.user.avatar }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                  {chat.user.isOnline && (
                    <View style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#2ECC71", borderWidth: 2, borderColor: t.primary }} />
                  )}
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{chat.user.name}</Text>
                  <Text style={{ color: "#E6FCF5", fontSize: 12 }}>{chat.user.isOnline ? "Online" : "Last seen recently"}</Text>
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={toggleMenu}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
          {open && (
            <TouchableOpacity activeOpacity={1} onPress={toggleMenu} style={{ position: "absolute", top: 48, right: 12 }}>
              <Animated.View style={[{ backgroundColor: t.card, borderRadius: 12, elevation: 6, borderWidth: 1, borderColor: t.hairline, overflow: "hidden" }, menuStyle]}>
                <TouchableOpacity style={{ padding: 14, minWidth: 160 }}>
                  <Text style={{ color: t.text, fontWeight: "600" }}>Settings</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: t.hairline }} />
                <TouchableOpacity style={{ padding: 14 }}>
                  <Text style={{ color: t.text, fontWeight: "600" }}>About Us</Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        {/* Messages */}
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 10 }}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.me ? "flex-end" : "flex-start",
                backgroundColor: item.me ? t.bubbleMe : t.bubbleThem,
                paddingHorizontal: 12, paddingVertical: 8,
                borderRadius: 16, marginVertical: 4, maxWidth: "78%",
                borderWidth: 1, borderColor: t.hairline
              }}
            >
              <Text style={{ color: t.text }}>{item.text}</Text>
            </View>
          )}
        />

        {/* Input */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: t.card, borderTopColor: t.hairline, borderTopWidth: 1 }}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="Type a message"
            placeholderTextColor={t.subtext}
            style={{ flex: 1, backgroundColor: "#F1F3F5", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: t.text }}
          />
          <TouchableOpacity onPress={send} style={{ marginLeft: 10 }}>
            <Ionicons name="send" color={t.mint} size={22} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
