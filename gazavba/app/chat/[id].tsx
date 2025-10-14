import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";
import ApiService from "../../src/services/api";
import SocketService from "../../src/services/socket";
import { ThemeCtx } from "../_layout";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";

type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error";

type Msg = {
  id: string;
  clientId?: string | null;
  me: boolean;
  text: string;
  status?: MessageStatus;
  timestamp?: string;
  messageType?: string;
  mediaUrl?: string | null;
};

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useContext(ThemeCtx);
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<Msg[]>([]);
  const [chat, setChat] = useState<any>(null);
  const menuScale = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  const handleIncomingMessage = useCallback(
    (messageData: any) => {
      if (messageData.chatId !== id) return;
      const message = messageData.message;
      const incoming: Msg = {
        id: message.id,
        me: message.senderId === user?.id,
        text: message.text,
        timestamp: message.timestamp,
        messageType: message.messageType,
        mediaUrl: message.mediaUrl,
        status:
          message.senderId === user?.id
            ? message.isRead
              ? "read"
              : "delivered"
            : undefined,
      };

      setData((prev) => {
        // For acknowledgements we match clientId
        if (incoming.me && message.clientId) {
          return prev.map((item) =>
            item.clientId === message.clientId || item.id === incoming.id
              ? { ...item, ...incoming, status: incoming.status ?? "delivered" }
              : item
          );
        }
        return [...prev, incoming];
      });
    },
    [id, user?.id]
  );

  const handleMessageSent = useCallback(
    (message: any) => {
      if (message.chatId !== id) return;
      setData((prev) =>
        prev.map((item) =>
          item.clientId === message.clientId || item.id === message.id
            ? {
                ...item,
                id: message.id,
                text: message.text,
                status: "delivered",
                timestamp: message.timestamp,
                mediaUrl: message.mediaUrl,
                messageType: message.messageType,
              }
            : item
        )
      );
    },
    [id]
  );

  const handleMessageError = useCallback((payload: any) => {
    if (payload?.clientId) {
      setData((prev) =>
        prev.map((item) =>
          item.clientId === payload.clientId ? { ...item, status: "error" } : item
        )
      );
    }
  }, []);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (id) {
      loadChatData();
      setupSocketListeners();
    }

    return () => {
      SocketService.off("new_message", handleIncomingMessage);
      SocketService.off("message_sent", handleMessageSent);
      SocketService.off("message_error", handleMessageError);
    };
  }, [id, enter, handleIncomingMessage, handleMessageError, handleMessageSent, loadChatData, setupSocketListeners]);

  const loadChatData = useCallback(async () => {
    try {
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
        senderAvatar: m.senderAvatar,
        timestamp: m.timestamp,
        messageType: m.messageType,
        mediaUrl: m.mediaUrl,
        status: m.senderId === user?.id ? (m.isRead ? "read" : "delivered") : undefined,
      }));
      setData(formattedMessages);

      // Mark chat as read
      await ApiService.markChatAsRead(id!);
    } catch (error) {
      console.error('Failed to load chat data:', error);
    }
  }, [id, user?.id]);

  const setupSocketListeners = useCallback(() => {
    SocketService.on("new_message", handleIncomingMessage);
    SocketService.on("message_sent", handleMessageSent);
    SocketService.on("message_error", handleMessageError);
  }, [handleIncomingMessage, handleMessageError, handleMessageSent]);

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
      const tempId = `client-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      setData((prev) => [
        ...prev,
        {
          id: tempId,
          clientId: tempId,
          me: true,
          text,
          status: "sending",
          messageType: "text",
        },
      ]);

      SocketService.sendMessage(id, user.id, text, 'text', tempId);
      setMsg("");
    } catch (error) {
      console.error('Failed to send message:', error);
      setData((prev) =>
        prev.map((item) =>
          item.clientId && item.clientId.startsWith('client-') && item.text === text
            ? { ...item, status: "error" }
            : item
        )
      );
    }
  };

  const displayUser = useMemo(() => {
    if (!chat?.participants || !user?.id) return chat?.otherParticipant ?? null;
    const others = (chat.participants || []).filter((p: any) => p.id !== user.id && p.userId !== user.id);
    return chat?.otherParticipant || others[0] || null;
  }, [chat, user?.id]);

  const displayName = chat?.displayName || displayUser?.name || chat?.name || "Conversation";
  const avatarUri = resolveAssetUri(chat?.avatar || displayUser?.avatar);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View style={{ transform: [{ translateY: enter.interpolate({ inputRange: [0,1], outputRange: [6,0] }) }], opacity: enter }}>
        {/* Header with back, avatar, name, online */}
        <View style={{ backgroundColor: t.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8, padding: 6 }}>
              <Ionicons name="chevron-back" color="#fff" size={22} />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View>
                <Image source={{ uri: avatarUri || "https://ui-avatars.com/api/?name=G&background=0C3B2E&color=fff" }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                {displayUser?.isOnline && (
                  <View style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#2ECC71", borderWidth: 2, borderColor: t.primary }} />
                )}
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{displayName}</Text>
                <Text style={{ color: "#E6FCF5", fontSize: 12 }}>
                  {displayUser?.isOnline
                    ? "Online"
                    : displayUser?.lastSeen
                      ? `Last seen ${new Date(displayUser.lastSeen).toLocaleString()}`
                      : "Last seen recently"}
                </Text>
              </View>
            </View>
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
          renderItem={({ item }) => {
            const statusIcon = item.me ? item.status : undefined;
            let iconName: any = null;
            let iconColor = t.subtext;
            if (statusIcon === "sending") {
              iconName = "time-outline";
            } else if (statusIcon === "sent") {
              iconName = "checkmark";
            } else if (statusIcon === "delivered") {
              iconName = "checkmark-done-outline";
            } else if (statusIcon === "read") {
              iconName = "checkmark-done";
              iconColor = t.mint;
            } else if (statusIcon === "error") {
              iconName = "alert-circle";
              iconColor = "#E03131";
            }

            return (
              <View
                style={{
                  alignSelf: item.me ? "flex-end" : "flex-start",
                  backgroundColor: item.me ? t.bubbleMe : t.bubbleThem,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                  marginVertical: 4,
                  maxWidth: "78%",
                  borderWidth: 1,
                  borderColor: t.hairline,
                }}
              >
                <Text style={{ color: t.text }}>{item.text}</Text>
                {iconName && (
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 4 }}>
                    <Ionicons name={iconName} size={14} color={iconColor} />
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: t.card, borderTopColor: t.hairline, borderTopWidth: 1 }}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="Type a message"
            placeholderTextColor={t.subtext}
            style={{
              flex: 1,
              backgroundColor: "#F1F3F5",
              borderRadius: 24,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 16,
              color: "#111",
            }}
          />
          <TouchableOpacity onPress={send} style={{ marginLeft: 10 }}>
            <Ionicons name="send" color={t.mint} size={22} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
