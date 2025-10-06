import React, { useContext } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Image } from "react-native";
import { ThemeCtx } from "./_layout";

export default function AboutScreen() {
  const t = useContext(ThemeCtx);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Image source={require("../assets/images/logo.png")} style={{ width: 96, height: 96, borderRadius: 16, marginBottom: 16 }} />
      <Text style={{ fontSize: 22, fontWeight: "800", color: t.text }}>Gazavba</Text>
      <Text style={{ color: t.subtext, marginTop: 8, textAlign: "center" }}>
        Instant messaging & status app. v1.0.0
      </Text>
    </SafeAreaView>
  );
}
