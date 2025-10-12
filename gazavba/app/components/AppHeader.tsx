import React from "react";
import { View, Text, Image } from "react-native";

type Props = { title?: string };
export default function AppHeader({ title = "Gazavba" }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={{ width: 26, height: 26, borderRadius: 6, marginRight: 8 }}
      />
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
        {title}
      </Text>
    </View>
  );
}
