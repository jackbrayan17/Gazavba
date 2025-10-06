import React, { useContext, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, Image, TouchableOpacity, Modal, Dimensions, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-video";
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

  const myStatus = useMemo(() => items.find(i => i.owner === "me"), [items]);

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

        {/* Mon statut */}
        <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={pick}>
            <Ring viewed={!!myStatus}>
              <Image source={{ uri: myStatus?.avatar || "https://i.pravatar.cc/120?img=1" }} style={{ width: 60, height: 60, borderRadius: 30 }} />
            </Ring>
          </TouchableOpacity>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>My Status</Text>
            <Text style={{ color: t.subtext, marginTop: 2 }}>{myStatus ? myStatus.time : "Tap to add photo or video"}</Text>
          </View>
          <TouchableOpacity onPress={pick} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.mint, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Statuts des contacts */}
        {items.filter(i => i.owner !== "me").map(s => (
          <TouchableOpacity key={s.id} onPress={() => open(s)} activeOpacity={0.85}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: t.hairline, marginBottom: 12 }}>
            <Ring viewed={s.viewed}>
              <Image source={{ uri: s.avatar }} style={{ width: 60, height: 60, borderRadius: 30 }} />
            </Ring>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: t.text }}>{s.owner}</Text>
              <Text style={{ color: t.subtext, marginTop: 2 }}>{s.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Viewer */}
      <Modal visible={!!viewer} transparent animationType="none" onRequestClose={close}>
        <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", opacity: fade }}>
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
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
