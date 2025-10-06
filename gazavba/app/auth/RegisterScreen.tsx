import React, { useContext, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemeCtx } from "../_layout";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

export default function RegisterScreen() {
  const theme = useContext(ThemeCtx);
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setAvatar(result.assets[0].uri);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.bg === theme.bgDark ? "light" : "dark"} />
      <Text style={[styles.title, { color: theme.primary }]}>
        Set up your profile
      </Text>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        Phone: {phone}
      </Text>

      <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: theme.card, borderColor: theme.mint },
            ]}
          >
            <Text style={{ color: theme.mint }}>Add Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        placeholder="Your name"
        placeholderTextColor={theme.subtext}
        value={name}
        onChangeText={setName}
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
        onPress={() => router.replace("(tabs)/ChatListScreen")}
        style={[styles.button, { backgroundColor: theme.mint }]}
      >
        <Text style={styles.buttonText}>Start Messaging</Text>
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
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
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