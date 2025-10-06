import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ThemeCtx } from "../_layout";

type Msg = { id: string; me: boolean; text: string };

const initial: Msg[] = [
  { id: "m1", me: false, text: "Hey, how are you?" },
  { id: "m2", me: true,  text: "Great! Building Gazavba 🚀" },
  { id: "m3", me: false, text: "Let’s ship it." }
];

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useContext(ThemeCtx);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<Msg[]>(initial);
  const menuScale = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);

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

  const send = () => {
    const text = msg.trim();
    if (!text) return;
    setData((d) => [...d, { id: String(Date.now()), me: true, text }]);
    setMsg("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View style={{ transform: [{ translateY: enter.interpolate({ inputRange: [0,1], outputRange: [6,0] }) }], opacity: enter }}>
        {/* Header */}
        <View style={{ backgroundColor: t.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image source={require("../../assets/images/logo.png")} style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }} />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Chat {id}</Text>
          </View>
          <View>
            <TouchableOpacity onPress={toggleMenu}>
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>

            {open && (
              <TouchableOpacity activeOpacity={1} onPress={toggleMenu} style={{ position: "absolute", top: 28, right: 0 }}>
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
