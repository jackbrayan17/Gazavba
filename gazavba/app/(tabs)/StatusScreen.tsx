import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { ResizeMode, Video } from "expo-video";
import React, { useContext, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ApiService from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { ThemeCtx } from "../_layout";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";

const WINDOW_WIDTH = Dimensions.get("window").width;

export type StatusItem = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  type: "text" | "image" | "video";
  content?: string | null;
  mediaUrl?: string | null;
  createdAt?: string | null;
  hasViewed?: number | boolean;
};

const INVITE_TEXT = "I just posted a new story on Gazavba";

export default function StatusScreen() {
  const theme = useContext(ThemeCtx);
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState<StatusItem | null>(null);
  const [textComposerVisible, setTextComposerVisible] = useState(false);
  const [textContent, setTextContent] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadStatuses = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getStatuses();
      setStatuses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load statuses", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadStatuses();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadStatuses();
    setRefreshing(false);
  }, []);

  const myStatuses = useMemo(() => statuses.filter((item) => item.userId === user?.id), [statuses, user?.id]);
  const otherStatuses = useMemo(() => statuses.filter((item) => item.userId !== user?.id), [statuses, user?.id]);

  const groupedByUser = useMemo(() => {
    const byUser = new Map<string, StatusItem[]>();
    otherStatuses.forEach((status) => {
      const key = status.userId;
      if (!byUser.has(key)) {
        byUser.set(key, []);
      }
      byUser.get(key)?.push(status);
    });
    return Array.from(byUser.entries()).map(([key, list]) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return {
        userId: key,
        latest: sorted[0],
        all: sorted,
        allViewed: sorted.every((item) => !!item.hasViewed),
      };
    });
  }, [otherStatuses]);

  const openStatus = async (status: StatusItem) => {
    setViewer(status);
    Animated.timing(fadeAnim, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    if (!status.hasViewed) {
      try {
        await ApiService.markStatusAsViewed(status.id);
        setStatuses((prev) =>
          prev.map((item) =>
            item.id === status.id
              ? { ...item, hasViewed: true }
              : item
          )
        );
      } catch (error) {
        console.error("Failed to mark status viewed", error);
      }
    }
  };

  const closeViewer = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() =>
      setViewer(null)
    );
  };

  const ensurePermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "We need access to your media library to share photos or videos.");
      return false;
    }
    return true;
  };

  const handleAddMediaStatus = async () => {
    const allowed = await ensurePermissions();
    if (!allowed) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    try {
      await ApiService.createMediaStatus({
        uri: asset.uri,
        mimeType: asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        name: asset.fileName || `status-${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
      });
      await loadStatuses();
    } catch (error) {
      console.error("Failed to upload status", error);
      Alert.alert("Upload failed", "Could not publish your status. Please try again.");
    }
  };

  const handleSubmitTextStatus = async () => {
    const text = textContent.trim();
    if (!text) {
      Alert.alert("Add some text", "Your status message cannot be empty.");
      return;
    }
    try {
      await ApiService.createTextStatus(text);
      setTextContent("");
      setTextComposerVisible(false);
      await loadStatuses();
    } catch (error) {
      console.error("Failed to create text status", error);
      Alert.alert("Error", "Could not publish your text status. Try again later.");
    }
  };

  const handleDownload = async (status: StatusItem | null) => {
    if (!status?.mediaUrl) return;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== "granted") return;
      const source = resolveAssetUri(status.mediaUrl);
      if (!source) return;
      const extension = status.type === "video" ? "mp4" : "jpg";
      const localUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}status-${status.id}.${extension}`;
      const download = await FileSystem.downloadAsync(source, localUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert("Saved", "Status saved to your gallery.");
    } catch (error) {
      console.error("Failed to save status", error);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary, marginBottom: 12 }}>Status</Text>

        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.hairline,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={handleAddMediaStatus}>
              <View
                style={{
                  borderWidth: 2,
                  borderColor: theme.mint,
                  borderRadius: 40,
                  padding: 2,
                }}
              >
                <Image
                  source={{ uri: resolveAssetUri(myStatuses[0]?.mediaUrl || myStatuses[0]?.userAvatar) || resolveAssetUri(user?.avatar) || "https://ui-avatars.com/api/?name=Me&background=0C3B2E&color=fff" }}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
              </View>
            </TouchableOpacity>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.text }}>My Status</Text>
              <Text style={{ color: theme.subtext, marginTop: 2 }}>
                {myStatuses[0]?.createdAt
                  ? `Last updated ${new Date(myStatuses[0].createdAt).toLocaleString()}`
                  : "Share a photo, video, or thought"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", marginTop: 16, gap: 12 }}>
            <TouchableOpacity
              onPress={handleAddMediaStatus}
              style={{ flex: 1, backgroundColor: theme.mint, paddingVertical: 10, borderRadius: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Add Photo/Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTextComposerVisible(true)}
              style={{ flex: 1, backgroundColor: theme.accent, paddingVertical: 10, borderRadius: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Add Text</Text>
            </TouchableOpacity>
          </View>
        </View>

        {groupedByUser.map(({ userId, latest, allViewed }) => (
          <TouchableOpacity
            key={userId}
            onPress={() => openStatus(latest)}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 12,
              borderWidth: 1,
              borderColor: theme.hairline,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                borderWidth: 2,
                borderColor: allViewed ? theme.hairline : theme.mint,
                padding: 2,
                borderRadius: 40,
              }}
            >
              <Image
                source={{ uri: resolveAssetUri(latest.userAvatar) || "https://ui-avatars.com/api/?background=0C3B2E&color=fff&name=G" }}
                style={{ width: 60, height: 60, borderRadius: 30 }}
              />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: theme.text }}>{latest.userName}</Text>
              <Text style={{ color: theme.subtext, marginTop: 2 }}>
                {latest.createdAt ? new Date(latest.createdAt).toLocaleString() : INVITE_TEXT}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {groupedByUser.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Ionicons name="sparkles" size={36} color={theme.subtext} />
            <Text style={{ color: theme.text, fontWeight: "700", marginTop: 12 }}>No friend updates yet</Text>
            <Text style={{ color: theme.subtext, marginTop: 4, textAlign: "center" }}>
              Share your invite link so friends can join and share their stories.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="none" onRequestClose={closeViewer}>
        <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", opacity: fadeAnim }}>
          <View style={{ position: "absolute", top: 48, left: 16, right: 16, zIndex: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TouchableOpacity onPress={closeViewer} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            {viewer?.mediaUrl && (
              <TouchableOpacity onPress={() => handleDownload(viewer)} style={{ padding: 8 }}>
                <Ionicons name="download" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeViewer}>
            {viewer && viewer.type === "image" && viewer.mediaUrl && (
              <Image source={{ uri: resolveAssetUri(viewer.mediaUrl) }} style={{ width: WINDOW_WIDTH, height: "100%", resizeMode: "contain" }} />
            )}
            {viewer && viewer.type === "video" && viewer.mediaUrl && (
              <Video
                source={{ uri: resolveAssetUri(viewer.mediaUrl)! }}
                style={{ width: WINDOW_WIDTH, height: "100%" }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
              />
            )}
            {viewer && viewer.type === "text" && (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
                <Text style={{ color: "#fff", fontSize: 26, textAlign: "center", fontWeight: "700" }}>{viewer.content}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      <Modal visible={textComposerVisible} transparent animationType="fade" onRequestClose={() => setTextComposerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, width: "86%", padding: 20, borderWidth: 1, borderColor: theme.hairline }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 12 }}>Share a thought</Text>
            <TextInput
              value={textContent}
              onChangeText={setTextContent}
              placeholder="What do you want to share?"
              placeholderTextColor={theme.subtext}
              multiline
              style={{ minHeight: 100, borderWidth: 1, borderColor: theme.hairline, borderRadius: 12, padding: 12, fontSize: 16, color: theme.text }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }}>
              <TouchableOpacity onPress={() => setTextComposerVisible(false)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: theme.subtext }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmitTextStatus} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: theme.mint, fontWeight: "700" }}>Publish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
