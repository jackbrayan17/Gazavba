import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { ResizeMode, Video } from "expo-video";
import { useAuth } from "../../src/contexts/AuthContext";
import ApiService from "../../src/services/api";
import SocketService from "../../src/services/socket";
import { ThemeCtx } from "../_layout";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";
import NotificationService from "../../src/services/notificationService";
import { useChatSession } from "../../src/contexts/ChatContext";

const formatDuration = (durationMillis: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

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
  mediaName?: string | null;
};

const TEMP_AUDIO_MIME = Platform.select({ ios: "audio/m4a", android: "audio/mpeg", default: "audio/m4a" });

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useContext(ThemeCtx);
  const { user } = useAuth();
  const { setActiveChat } = useChatSession();
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<Msg[]>([]);
  const [chat, setChat] = useState<any>(null);
  const menuScale = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const [showPalette, setShowPalette] = useState(false);
  const paletteAnim = useRef(new Animated.Value(0)).current;
  const [isUploading, setIsUploading] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordInterval = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setActiveChat(id);
    }
    return () => {
      setActiveChat(null);
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        mediaName: message.mediaName,
        status:
          message.senderId === user?.id
            ? message.isRead
              ? "read"
              : "delivered"
            : undefined,
      };

      setData((prev) => {
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
                mediaName: message.mediaName,
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

  const loadChatData = useCallback(async () => {
    try {
      const [chatData, messages] = await Promise.all([
        ApiService.getChat(id!),
        ApiService.getMessages(id!),
      ]);

      setChat(chatData);
      const formattedMessages = messages.map((m: any) => ({
        id: m.id,
        me: m.senderId === user?.id,
        text: m.text,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        timestamp: m.timestamp,
        messageType: m.messageType,
        mediaUrl: m.mediaUrl,
        mediaName: m.mediaName,
        status: m.senderId === user?.id ? (m.isRead ? "read" : "delivered") : undefined,
      }));
      setData(formattedMessages);

      const muted = !!chatData?.isMuted || (chatData?.muteUntil && new Date(chatData.muteUntil).getTime() > Date.now());
      setIsMuted(muted);
      setMuteUntil(chatData?.muteUntil || null);
      if (chatData?.id) {
        NotificationService.setMuted(chatData.id, muted);
      }

      await ApiService.markChatAsRead(id!);
    } catch (error) {
      console.error("Failed to load chat data:", error);
    }
  }, [id, user?.id]);

  const setupSocketListeners = useCallback(() => {
    SocketService.on("new_message", handleIncomingMessage);
    SocketService.on("message_sent", handleMessageSent);
    SocketService.on("message_error", handleMessageError);
  }, [handleIncomingMessage, handleMessageError, handleMessageSent]);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
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

  const toggleMenu = () => {
    setOpen((v) => {
      const next = !v;
      Animated.timing(menuScale, {
        toValue: next ? 1 : 0,
        duration: 160,
        easing: next ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
      return next;
    });
  };

  const menuStyle = useMemo(
    () => [
      {
        transform: [
          { scale: menuScale.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          { translateY: menuScale.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
        ],
        opacity: menuScale,
      },
    ],
    [menuScale]
  );

  const sendTextMessage = async () => {
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

      SocketService.sendMessage(id, user.id, text, "text", tempId, null, null);
      setMsg("");
    } catch (error) {
      console.error("Failed to send message:", error);
      setData((prev) =>
        prev.map((item) =>
          item.clientId && item.clientId.startsWith("client-") && item.text === text
            ? { ...item, status: "error" }
            : item
        )
      );
    }
  };

  const stopPlayback = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }
    } catch (error) {
      console.warn("Failed to stop audio", error);
    } finally {
      soundRef.current = null;
      setPlayingId(null);
    }
  };

  const handlePlayAudio = async (message: Msg) => {
    const source = resolveAssetUri(message.mediaUrl) || message.mediaUrl;
    if (!source) return;
    if (playingId === message.id) {
      await stopPlayback();
      return;
    }

    try {
      await stopPlayback();
      const { sound } = await Audio.Sound.createAsync({ uri: source });
      soundRef.current = sound;
      setPlayingId(message.id);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          stopPlayback();
        }
      });
    } catch (error) {
      console.error("Failed to play audio", error);
      stopPlayback();
    }
  };

  const sendMediaMessage = async ({
    uri,
    mimeType,
    name,
    messageType,
    textLabel,
  }: {
    uri: string;
    mimeType: string;
    name: string;
    messageType: string;
    textLabel: string;
  }) => {
    if (!id || !user) return;

    const tempId = `client-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    setData((prev) => [
      ...prev,
      {
        id: tempId,
        clientId: tempId,
        me: true,
        text: textLabel,
        status: "sending",
        messageType,
        mediaUrl: uri,
        mediaName: name,
      },
    ]);

    try {
      setIsUploading(true);
      const upload = await ApiService.uploadMessageAttachment({ uri, mimeType, name });
      const remoteUrl = upload?.url || upload?.mediaUrl || upload?.path || upload?.fileUrl;
      SocketService.sendMessage(id, user.id, textLabel, messageType, tempId, remoteUrl || uri, name);
    } catch (error: any) {
      console.error("Failed to send media", error);
      Alert.alert("Upload failed", error?.message || "Unable to send attachment.");
      setData((prev) =>
        prev.map((item) => (item.clientId === tempId ? { ...item, status: "error" } : item))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone required", "Please allow microphone access to record voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordInterval.current = setInterval(async () => {
        try {
          const status = await recording.getStatusAsync();
          if (status.isRecording) {
            setRecordingDuration(status.durationMillis ?? 0);
          }
        } catch {
          /* ignore */
        }
      }, 200);
    } catch (error) {
      console.error("Failed to start recording", error);
      Alert.alert("Recording failed", "Could not start audio recording.");
    }
  };

  const stopRecording = async (sendNote: boolean) => {
    const recording = recordingRef.current;
    if (!recording) return;

    if (recordInterval.current) {
      clearInterval(recordInterval.current);
      recordInterval.current = null;
    }

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      const duration = status?.durationMillis ?? recordingDuration;
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      if (uri && sendNote) {
        await sendMediaMessage({
          uri,
          mimeType: TEMP_AUDIO_MIME!,
          name: `voice-${Date.now()}.m4a`,
          messageType: "audio",
          textLabel: `Voice note • ${formatDuration(duration)}`,
        });
      }
    } catch (error) {
      console.error("Failed to stop recording", error);
      Alert.alert("Recording error", "Could not save your voice note.");
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recordInterval.current) {
        clearInterval(recordInterval.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePalette = () => {
    const next = !showPalette;
    setShowPalette(next);
    Animated.timing(paletteAnim, {
      toValue: next ? 1 : 0,
      duration: 180,
      easing: next ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePickMedia = async () => {
    togglePalette();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || !result.assets[0]) return;
    const asset = result.assets[0];
    await sendMediaMessage({
      uri: asset.uri,
      mimeType: asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      name: asset.fileName || `media-${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
      messageType: asset.type === "video" ? "video" : "image",
      textLabel: asset.type === "video" ? "Shared a video" : "Shared a photo",
    });
  };

  const handlePickDocument = async () => {
    togglePalette();
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.type !== "success") return;
    await sendMediaMessage({
      uri: result.uri,
      mimeType: result.mimeType || "application/octet-stream",
      name: result.name,
      messageType: "file",
      textLabel: result.name,
    });
  };

  const handleMute = async (durationMinutes?: number | null) => {
    if (!id) return;
    try {
      if (durationMinutes === undefined) {
        await ApiService.unmuteChat(id);
        setIsMuted(false);
        setMuteUntil(null);
        NotificationService.setMuted(id, false);
      } else {
        await ApiService.muteChat(id, durationMinutes ?? null);
        setIsMuted(true);
        const until = durationMinutes
          ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
          : null;
        setMuteUntil(until);
        NotificationService.setMuted(id, true);
      }
      toggleMenu();
    } catch (error: any) {
      Alert.alert("Mute failed", error?.message || "Unable to update mute settings.");
    }
  };

  const displayUser = useMemo(() => {
    if (!chat?.participants || !user?.id) return chat?.otherParticipant ?? null;
    const others = (chat.participants || []).filter(
      (p: any) => p.id !== user.id && p.userId !== user.id
    );
    return chat?.otherParticipant || others[0] || null;
  }, [chat, user?.id]);

  const displayName = chat?.displayName || displayUser?.name || chat?.name || "Conversation";
  const avatarUri = resolveAssetUri(chat?.avatar || displayUser?.avatar);
  const effectiveMute = isMuted || (muteUntil && new Date(muteUntil).getTime() > Date.now());

  const renderMessage = ({ item }: { item: Msg }) => {
    const statusIcon = item.me ? item.status : undefined;
    let iconName: keyof typeof Ionicons.glyphMap | null = null;
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

    const bubbleStyle = [
      styles.bubble,
      {
        alignSelf: item.me ? "flex-end" : "flex-start",
        backgroundColor: item.me ? t.bubbleMe : t.bubbleThem,
        borderColor: t.hairline,
      },
    ];

    const textColor = { color: item.me ? t.text : t.text };

    const media = item.mediaUrl ? resolveAssetUri(item.mediaUrl) || item.mediaUrl : null;

    return (
      <View style={bubbleStyle}>
        {item.messageType === "image" && media ? (
          <Image source={{ uri: media }} style={styles.imagePreview} resizeMode="cover" />
        ) : null}
        {item.messageType === "video" && media ? (
          <View style={styles.videoPreview}>
            <Video
              style={StyleSheet.absoluteFill}
              source={{ uri: media }}
              resizeMode={ResizeMode.COVER}
              isMuted
              shouldPlay={false}
            />
            <View style={styles.videoOverlay}>
              <Ionicons name="play" color="#fff" size={20} />
            </View>
          </View>
        ) : null}
        {item.messageType === "audio" && media ? (
          <TouchableOpacity
            style={styles.audioBubble}
            onPress={() => handlePlayAudio(item)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={playingId === item.id ? "pause" : "play"}
              size={20}
              color={t.primary}
            />
            <Text style={[styles.audioText, textColor]}>
              {item.text || "Voice note"}
            </Text>
          </TouchableOpacity>
        ) : null}
        {item.messageType === "file" && media ? (
          <TouchableOpacity
            style={styles.fileBubble}
            onPress={() => Linking.openURL(media).catch(() => {})}
            activeOpacity={0.8}
          >
            <Ionicons name="document" size={20} color={t.primary} />
            <Text numberOfLines={2} style={[styles.fileName, textColor]}>
              {item.text || item.mediaName || "Attachment"}
            </Text>
          </TouchableOpacity>
        ) : null}
        {(!item.messageType || item.messageType === "text") && (
          <Text style={[styles.messageText, textColor]}>{item.text}</Text>
        )}
        {iconName && (
          <View style={styles.statusRow}>
            {statusIcon === "error" ? (
              <Ionicons name={iconName} size={16} color={iconColor} />
            ) : statusIcon === "sending" ? (
              <ActivityIndicator size="small" color={iconColor} style={{ marginLeft: 4 }} />
            ) : (
              <Ionicons name={iconName} size={14} color={iconColor} />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View
        style={{
          transform: [
            {
              translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
            },
          ],
          opacity: enter,
          flex: 1,
        }}
      >
        <View style={[styles.header, { backgroundColor: t.primary }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
              <Ionicons name="chevron-back" color="#fff" size={22} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <View>
                <Image
                  source={{
                    uri:
                      avatarUri ||
                      "https://ui-avatars.com/api/?name=G&background=0C3B2E&color=fff",
                  }}
                  style={styles.headerAvatar}
                />
                {displayUser?.isOnline && <View style={[styles.onlineDot, { borderColor: t.primary }]} />}
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.headerTitle}>{displayName}</Text>
                <Text style={styles.headerSubtitle}>
                  {effectiveMute
                    ? "Notifications muted"
                    : displayUser?.isOnline
                    ? "Online"
                    : displayUser?.lastSeen
                    ? `Last seen ${new Date(displayUser.lastSeen).toLocaleString()}`
                    : "Last seen recently"}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={toggleMenu} style={{ padding: 6 }}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
          {open && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={toggleMenu}
              style={styles.menuBackdrop}
            >
              <Animated.View
                style={[styles.menu, { backgroundColor: t.card, borderColor: t.hairline }, menuStyle]}
              >
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMute(60)}>
                  <Ionicons name="notifications" size={18} color={t.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, { color: t.text }]}>Mute for 1 hour</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMute(480)}>
                  <Ionicons name="moon" size={18} color={t.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, { color: t.text }]}>Mute until tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMute(null)}>
                  <Ionicons name="notifications-off" size={18} color={t.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuText, { color: t.text }]}>Mute indefinitely</Text>
                </TouchableOpacity>
                {effectiveMute && (
                  <TouchableOpacity style={styles.menuItem} onPress={() => handleMute(undefined)}>
                    <Ionicons name="volume-high" size={18} color={t.text} style={{ marginRight: 12 }} />
                    <Text style={[styles.menuText, { color: t.text }]}>Unmute</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        {showPalette && (
          <Animated.View
            style={[
              styles.palette,
              {
                backgroundColor: t.card,
                borderColor: t.hairline,
                opacity: paletteAnim,
                transform: [
                  {
                    translateY: paletteAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity style={styles.paletteItem} onPress={handlePickMedia}>
              <Ionicons name="image" size={22} color={t.accent} />
              <Text style={[styles.paletteText, { color: t.text }]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.paletteItem} onPress={handlePickDocument}>
              <Ionicons name="document" size={22} color={t.accent} />
              <Text style={[styles.paletteText, { color: t.text }]}>Document</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 80 }}
          renderItem={renderMessage}
        />

        <View style={[styles.inputBar, { backgroundColor: t.card, borderTopColor: t.hairline }]}>
          {isRecording ? (
            <View style={styles.recordingBar}>
              <View style={styles.recordingDot} />
              <Text style={{ color: t.text, fontWeight: "700", marginRight: 12 }}>
                Recording {formatDuration(recordingDuration)}
              </Text>
              <TouchableOpacity
                style={[styles.recordControl, { backgroundColor: "#ff6b6b" }]}
                onPress={() => stopRecording(false)}
              >
                <Text style={styles.recordControlText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recordControl, { backgroundColor: t.mint }]}
                onPress={() => stopRecording(true)}
              >
                <Text style={styles.recordControlText}>Send</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={togglePalette} style={styles.iconButton}>
                <Ionicons name={showPalette ? "close" : "attach"} size={22} color={t.subtext} />
              </TouchableOpacity>
              <TextInput
                value={msg}
                onChangeText={setMsg}
                placeholder="Type a message"
                placeholderTextColor={t.subtext}
                style={[styles.textInput, { color: t.text }]}
              />
              {msg.trim().length > 0 ? (
                <TouchableOpacity onPress={sendTextMessage} style={styles.iconButton}>
                  <Ionicons name="send" color={t.mint} size={22} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={startRecording} style={styles.iconButton}>
                  <Ionicons name="mic" color={t.mint} size={22} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        {isUploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator color={t.primary} />
            <Text style={{ color: t.text, marginTop: 6 }}>Uploading…</Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerBack: {
    marginRight: 6,
    padding: 6,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2ECC71",
    borderWidth: 2,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  headerSubtitle: {
    color: "#E6FCF5",
    fontSize: 12,
  },
  menuBackdrop: {
    position: "absolute",
    top: 48,
    right: 12,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 4,
    width: 220,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: {
    fontWeight: "600",
  },
  palette: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: 6,
  },
  paletteItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  paletteText: {
    fontWeight: "600",
    fontSize: 12,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: "78%",
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  imagePreview: {
    width: 220,
    height: 220,
    borderRadius: 14,
    marginBottom: 6,
  },
  videoPreview: {
    width: 220,
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 6,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  audioBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  audioText: {
    fontWeight: "600",
  },
  fileBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  fileName: {
    flex: 1,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  iconButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F3F5",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginHorizontal: 8,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ff6b6b",
  },
  recordControl: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  recordControlText: {
    color: "#fff",
    fontWeight: "700",
  },
  uploadOverlay: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
