import React, { useContext, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ThemeCtx } from "../_layout";
import { StatusBar } from "expo-status-bar";

export default function LoginScreen() {
  const theme = useContext(ThemeCtx);
  const router = useRouter();
  const [phone, setPhone] = useState("");

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.bg === theme.bgDark ? "light" : "dark"} />
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
      />
      <Text style={[styles.title, { color: theme.primary }]}>
        Welcome to Gazavba
      </Text>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        Connect easily with your contacts
      </Text>

      <TextInput
        placeholder="Enter your phone number"
        placeholderTextColor={theme.subtext}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        style={[
          styles.input,
          {
            backgroundColor: theme.card,
            color: theme.text,
            borderColor: theme.hairline,
          },
        ]}
      />

      <TouchableOpacity
        onPress={() =>
          router.push({ pathname: "(auth)/RegisterScreen", params: { phone } })
        }
        style={[styles.button, { backgroundColor: theme.mint }]}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 16,
    marginVertical: 10,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginTop: 24,
  },
  button: {
    marginTop: 28,
    paddingVertical: 14,
    width: "100%",
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});