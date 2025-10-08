import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { ResizeMode, Video } from "expo-video";
import React, { useContext, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeCtx } from "../_layout";

type StatusItem = {
  id: string;
  owner: string;          // "me" or contact name
  mediaUri: string;
  mediaType: "image" | "video";
  time: string;
  viewed: boolean;
  avatar: string;
};

const W = Dimensions.get("window").width;

export default function StatusScreen() {
  const t = useContext(ThemeCtx);
  const [items, setItems] = useState<StatusItem[]>([
    { id: "s1", owner: "Brenda", mediaUri: "https://picsum.photos/800/1300?1", mediaType: "image", time: "Today 08:45", viewed: false, avatar: "https://i.pravatar.cc/120?img=3" },
    { id: "s2", owner: "Marcus", mediaUri: "https://picsum.photos/800/1300?2", mediaType: "image", time: "Yesterday 22:00", viewed: true, avatar: "https://i.pravatar.cc/120?img=5" }
  ]);
  const [viewer, setViewer] = useState<StatusItem | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState("");

  const myLatest = useMemo(() => items.find(i => i.owner === "me"), [items]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.owner !== "me") set.add(i.owner); });
    return Array.from(set);
  }, [items]);

  const othersLatest = useMemo(() => {
    return owners
      .filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
      .map(owner => {
        const byOwner = items.filter(i => i.owner === owner);
        const latest = byOwner[0]; // newest first
        const viewed = byOwner.every(i => i.viewed);
        return { latest, viewed } as { latest: StatusItem; viewed: boolean };
      });
  }, [owners, items, query]);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.7
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      const mediaType = (asset.type === "video" ? "video" : "image") as "video" | "image";
      const mine: StatusItem = {
        id: "me-" + Date.now(),
        owner: "me",
        mediaUri: asset.uri,
        mediaType,
        time: "Just now",
        viewed: false,
        avatar: "https://i.pravatar.cc/120?img=1"
      };
      setItems((arr) => [mine, ...arr.filter(a => a.owner !== "me")]);
    }
  };

  const open = (s: StatusItem) => {
    setViewer(s);
    Animated.timing(fade, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    // Marque comme vu
    setItems(prev => prev.map(it => it.id === s.id ? { ...it, viewed: true } : it));
  };

  const close = () => {
    Animated.timing(fade, { toValue: 0, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setViewer(null));
  };

  const Ring = ({ viewed }: { viewed: boolean }) => (
    <View style={{
      borderWidth: 2,
      borderColor: viewed ? "#9AA4AE" : t.tabActive,
      padding: 2,
      borderRadius: 999
    }}>
      {/* children injected by parent: avatar */}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.primary, marginBottom: 12 }}>Status</Text>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.hairline, paddingHorizontal: 12, height: 44, marginBottom: 14 }}>
          <Ionicons name="search" size={18} color={t.subtext} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search contacts"
            placeholderTextColor={t.subtext}
            style={{ flex: 1, color: t.text, fontSize: 16, marginLeft: 8 }}
          />
        </View>

        {/* Mon statut */}
        <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={pick}>
            <Ring viewed={!!myLatest}>
              {myLatest ? (
                <Image source={{ uri: myLatest.mediaUri }} style={{ width: 60, height: 60, borderRadius: 30 }} />
              ) : (
                <Image source={{ uri: "https://i.pravatar.cc/120?img=1" }} style={{ width: 60, height: 60, borderRadius: 30 }} />
              )}
            </Ring>
          </TouchableOpacity>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>My Status</Text>
            <Text style={{ color: t.subtext, marginTop: 2 }}>{myLatest ? myLatest.time : "Tap to add photo or video"}</Text>
          </View>
          <TouchableOpacity onPress={pick} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.mint, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Statuts des contacts */}
        {othersLatest.map(({ latest, viewed }) => (
          <TouchableOpacity key={latest.id} onPress={() => open(latest)} activeOpacity={0.85}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 12 }}>
            <Ring viewed={viewed}>
              <Image source={{ uri: latest.mediaUri }} style={{ width: 60, height: 60, borderRadius: 30 }} />
            </Ring>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>{latest.owner}</Text>
              <Text style={{ color: t.subtext, marginTop: 2 }}>{latest.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Viewer */}
      <Modal visible={!!viewer} transparent animationType="none" onRequestClose={close}>
        <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", opacity: fade }}>
          {/* Top bar */}
          <View style={{ position: "absolute", top: 40, left: 16, right: 16, zIndex: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TouchableOpacity onPress={close} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                if (!viewer) return;
                try {
                  const perm = await MediaLibrary.requestPermissionsAsync();
                  if (perm.status !== "granted") return;
                  const fileUri = FileSystem.cacheDirectory + viewer.id + (viewer.mediaType === "video" ? ".mp4" : ".jpg");
                  const dl = await FileSystem.downloadAsync(viewer.mediaUri, fileUri);
                  await MediaLibrary.saveToLibraryAsync(dl.uri);
                } catch {}
              }}
              style={{ padding: 8 }}
            >
              <Ionicons name="download" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close}>
            {viewer && viewer.mediaType === "image" && (
              <Image source={{ uri: viewer.mediaUri }} style={{ width: W, height: "100%", resizeMode: "contain" }} />
            )}
            {viewer && viewer.mediaType === "video" && (
              <Video
                source={{ uri: viewer.mediaUri }}
                style={{ width: W, height: "100%" }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                useNativeControls={false}
              />
            )}
          </TouchableOpacity>

          {/* Comment box for others */}
          {viewer && viewer.owner !== "me" && (
            <View style={{ position: "absolute", left: 16, right: 16, bottom: 28, flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                <TextInput placeholder="Reply..." placeholderTextColor="#DEE2E6" style={{ color: "#fff", fontSize: 16 }} />
              </View>
              <TouchableOpacity style={{ marginLeft: 10, backgroundColor: "#12B886", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
