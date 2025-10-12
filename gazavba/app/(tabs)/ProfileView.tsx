import * as ImagePicker from "expo-image-picker";
import React, { useContext, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Image, TouchableOpacity, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { ThemeCtx } from "../_layout";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";

export default function ProfileView() {
  const theme = useContext(ThemeCtx);
  const router = useRouter();
  const { user, updateProfile, uploadAvatar, logout } = useAuth();
  const [editVisible, setEditVisible] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  const avatarUri = resolveAssetUri(user?.avatar) || "https://ui-avatars.com/api/?name=G&background=0C3B2E&color=fff";

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    try {
      await uploadAvatar({
        uri: asset.uri,
        mimeType: asset.mimeType || "image/jpeg",
        name: asset.fileName || "avatar.jpg",
      });
    } catch (err) {
      console.error("Avatar update failed", err);
      Alert.alert("Update failed", "We couldn't update your photo. Please try again later.");
    }
  };

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert("Enter a name", "Your display name cannot be empty.");
      return;
    }
    try {
      setSaving(true);
      await updateProfile({ name: trimmed });
      setEditVisible(false);
    } catch (err) {
      console.error("Profile update failed", err);
      Alert.alert("Update failed", "We couldn't update your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ alignItems: "center", paddingTop: 32, paddingBottom: 16, paddingHorizontal: 20 }}>
        <TouchableOpacity activeOpacity={0.85} onPress={handlePickAvatar}>
          <View style={{ borderWidth: 2, borderColor: theme.mint, padding: 4, borderRadius: 80 }}>
            <Image source={{ uri: avatarUri }} style={{ width: 140, height: 140, borderRadius: 70 }} />
            <View
              style={{
                position: "absolute",
                right: 6,
                bottom: 6,
                backgroundColor: theme.accent,
                borderRadius: 16,
                padding: 6,
              }}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "800", marginTop: 16, color: theme.text }}>{user?.name}</Text>
        <Text style={{ color: theme.subtext, marginTop: 4 }}>{user?.phone ? `+${user.phone.replace(/^[+]/, "")}` : "Phone not set"}</Text>
      </View>

      <View style={{ marginHorizontal: 20, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.hairline }}>
        <TouchableOpacity onPress={() => setEditVisible(true)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="create-outline" size={22} color={theme.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: theme.text }}>Change name</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickAvatar} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="image-outline" size={22} color={theme.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: theme.text }}>Change photo</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/contacts")} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="people-outline" size={22} color={theme.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: theme.text }}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/about")} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
          <Ionicons name="information-circle-outline" size={22} color={theme.accent} />
          <Text style={{ marginLeft: 12, fontSize: 16, color: theme.text }}>About</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={logout}
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          backgroundColor: theme.card,
          borderRadius: 16,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: theme.hairline,
        }}
      >
        <Ionicons name="log-out-outline" size={20} color="#E03131" />
        <Text style={{ marginLeft: 8, fontWeight: "700", color: "#E03131" }}>Logout</Text>
      </TouchableOpacity>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, width: "86%", padding: 20, borderWidth: 1, borderColor: theme.hairline }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 10 }}>Change your name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter name"
              placeholderTextColor={theme.subtext}
              style={{ borderWidth: 1, borderColor: theme.hairline, backgroundColor: "#F1F3F5", color: theme.text, borderRadius: 12, padding: 12, fontSize: 16 }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: theme.subtext }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={handleSaveName} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: theme.mint, fontWeight: "800" }}>{saving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
