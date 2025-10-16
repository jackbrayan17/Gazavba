import { useRouter } from "expo-router";
import React, { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../src/contexts/AuthContext";
import ApiService from "../../src/services/api";
import { ThemeCtx } from "../_layout";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";
import useMatchedContacts, {
  InviteContact,
  MatchedContact,
  normalizePhone,
} from "../../src/hooks/useMatchedContacts";

const INVITE_LINK = "https://gazavba.app/download";

export default function ContactsScreen() {
  const theme = useContext(ThemeCtx);
  const router = useRouter();
  const { user } = useAuth();
  const {
    matches: matchedContacts,
    invites,
    loading: contactsLoading,
    permissionState,
    requestAccess,
    refresh,
    error: contactsError,
    supportsContacts,
  } = useMatchedContacts(user?.id);

  const [searchQuery, setSearchQuery] = useState("");
  const [addVisible, setAddVisible] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matchedContacts;
    const term = searchQuery.trim().toLowerCase();
    return matchedContacts.filter((item) =>
      item.name.toLowerCase().includes(term) || item.contactName?.toLowerCase().includes(term)
    );
  }, [matchedContacts, searchQuery]);

  const filteredInvites = useMemo(() => {
    if (!searchQuery.trim()) return invites;
    const term = searchQuery.trim().toLowerCase();
    return invites.filter((item) =>
      item.name.toLowerCase().includes(term) || item.phone.toLowerCase().includes(term)
    );
  }, [invites, searchQuery]);

  const handleContactPress = async (contact: MatchedContact) => {
    try {
      const chat = await ApiService.createChat({
        type: "direct",
        participants: [contact.id],
      });

      router.push({
        pathname: "/chat/[id]",
        params: {
          id: chat.id,
        },
      });
    } catch (error) {
      console.error("Failed to create chat", error);
      Alert.alert("Error", "We couldn't open a conversation with this contact.");
    }
  };

  const handleInvite = async (contact: InviteContact) => {
    const message = `Join me on Gazavba! ${INVITE_LINK}`;
    try {
      await Share.share({
        message,
        title: "Gazavba Invite",
      });
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(INVITE_LINK);
      Alert.alert("Copied", "Invite link copied to clipboard.");
    } catch (error) {
      console.error("Clipboard error", error);
    }
  };

  const handleCreateContact = async () => {
    const name = newContactName.trim();
    const phone = normalizePhone(newContactPhone);

    if (!name || !phone) {
      Alert.alert("Missing info", "Please provide both a name and a phone number.");
      return;
    }

    try {
      setSavingContact(true);
      await Contacts.addContactAsync({
        [Contacts.Fields.FirstName]: name,
        [Contacts.Fields.Name]: name,
        [Contacts.Fields.PhoneNumbers]: [{ label: "mobile", number: phone }],
      } as any);
      setAddVisible(false);
      setNewContactName("");
      setNewContactPhone("");
      await refresh();
    } catch (error) {
      console.error("Failed to add contact", error);
      Alert.alert("Error", "Could not save the contact on your device.");
    } finally {
      setSavingContact(false);
    }
  };

  const renderPermissionCard = () => {
    if (!supportsContacts) {
      return (
        <View
          style={{
            margin: 20,
            padding: 20,
            backgroundColor: theme.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.hairline,
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>Contacts unavailable</Text>
          <Text style={{ color: theme.subtext, marginTop: 8 }}>
            This platform cannot access your device contacts. You can still search for teammates manually using
            their phone numbers.
          </Text>
        </View>
      );
    }

    if (permissionState === "granted") {
      return null;
    }

    const isDenied = permissionState === "denied";

    return (
      <View
        style={{
          margin: 20,
          padding: 20,
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.hairline,
        }}
      >
        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>Share your contacts</Text>
        <Text style={{ color: theme.subtext, marginTop: 8 }}>
          Allow Gazavba to read your contacts so we can automatically connect you with friends already using the
          platform.
        </Text>
        <TouchableOpacity
          onPress={isDenied ? () => Linking.openSettings().catch(() => {}) : requestAccess}
          style={{
            marginTop: 16,
            backgroundColor: theme.primary,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {isDenied ? "Open settings" : "Grant access"}
          </Text>
        </TouchableOpacity>
        {isDenied && (
          <Text style={{ color: theme.subtext, marginTop: 8 }}>
            Permission was previously denied. Use your system settings to enable contact access for Gazavba, then
            return to this screen.
          </Text>
        )}
      </View>
    );
  };

  if (permissionState !== "granted") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        {renderPermissionCard()}
      </SafeAreaView>
    );
  }

  if (contactsLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
      <Text style={{ color: theme.subtext, textTransform: "uppercase", fontSize: 12 }}>Find friends</Text>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800", marginTop: 4 }}>Contacts</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.hairline,
          backgroundColor: theme.card,
          paddingHorizontal: 14,
          height: 48,
          marginTop: 16,
        }}
      >
        <Ionicons name="search" size={18} color={theme.subtext} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or number"
          placeholderTextColor={theme.subtext}
          style={{ flex: 1, marginLeft: 10, fontSize: 16, color: theme.text }}
        />
        <TouchableOpacity onPress={() => refresh()}>
          <Ionicons name="refresh" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>
      {contactsError && <Text style={{ color: theme.accent, marginTop: 8 }}>{contactsError}</Text>}
    </View>
  );

  const renderMatchedItem = ({ item }: { item: MatchedContact }) => (
    <TouchableOpacity
      onPress={() => handleContactPress(item)}
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
      <Image
        source={{
          uri:
            resolveAssetUri(item.avatar) ||
            "https://ui-avatars.com/api/?background=0C3B2E&color=fff&name=G",
        }}
        style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: theme.text }}>
          {item.contactName || item.name}
        </Text>
        <Text style={{ color: theme.subtext, marginTop: 2 }}>{item.isOnline ? "Online" : "Offline"}</Text>
      </View>
      <Ionicons name="chatbubble-ellipses" size={20} color={theme.accent} />
    </TouchableOpacity>
  );

  const renderInviteItem = ({ item }: { item: InviteContact }) => (
    <View
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
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.hairline,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name="person-add" size={20} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: theme.text }}>{item.name}</Text>
        <Text style={{ color: theme.subtext, marginTop: 2 }}>{item.phone}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleInvite(item)}
        style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.mint, borderRadius: 10, marginRight: 8 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Invite</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleCopyLink}
        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.hairline }}
      >
        <Text style={{ color: theme.text, fontWeight: "600" }}>Copy</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {renderHeader()}

      <View style={{ paddingHorizontal: 20 }}>
        {supportsContacts && (
          <TouchableOpacity
            onPress={() => setAddVisible(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: theme.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.hairline,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 16,
            }}
          >
            <Ionicons name="person-add" size={18} color={theme.accent} />
            <Text style={{ marginLeft: 8, color: theme.text, fontWeight: "600" }}>Add contact</Text>
          </TouchableOpacity>
        )}

        <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 8, fontWeight: "700" }}>On Gazavba</Text>
        <FlatList
          data={filteredMatches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchedItem}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={contactsLoading} onRefresh={refresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Ionicons name="sparkles" size={32} color={theme.subtext} />
              <Text style={{ color: theme.text, fontWeight: "700", marginTop: 8 }}>No contacts found</Text>
              <Text style={{ color: theme.subtext, marginTop: 4, textAlign: "center" }}>
                Pull down to refresh or invite your friends to join Gazavba.
              </Text>
            </View>
          }
        />

        <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 8, fontWeight: "700", marginTop: 16 }}>
          Invite to Gazavba
        </Text>
        <FlatList
          data={filteredInvites}
          keyExtractor={(item) => item.phone}
          renderItem={renderInviteItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Ionicons name="party-popper" size={32} color={theme.subtext} />
              <Text style={{ color: theme.text, fontWeight: "700", marginTop: 8 }}>Everyone is already here</Text>
              <Text style={{ color: theme.subtext, marginTop: 4, textAlign: "center" }}>
                All of your synced contacts already use Gazavba.
              </Text>
            </View>
          }
        />
      </View>

      <Modal visible={addVisible} transparent animationType="fade" onRequestClose={() => setAddVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" }}>
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              width: "86%",
              padding: 20,
              borderWidth: 1,
              borderColor: theme.hairline,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 16 }}>New contact</Text>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ marginBottom: 6, color: theme.subtext, fontWeight: "600" }}>Name</Text>
              <TextInput
                value={newContactName}
                onChangeText={setNewContactName}
                placeholder="Contact name"
                placeholderTextColor={theme.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: theme.hairline,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: theme.text,
                }}
              />
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ marginBottom: 6, color: theme.subtext, fontWeight: "600" }}>Phone</Text>
              <TextInput
                value={newContactPhone}
                onChangeText={setNewContactPhone}
                placeholder="Phone number"
                placeholderTextColor={theme.subtext}
                keyboardType="phone-pad"
                style={{
                  borderWidth: 1,
                  borderColor: theme.hairline,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: theme.text,
                }}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
              <TouchableOpacity onPress={() => setAddVisible(false)} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: theme.subtext }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateContact}
                disabled={savingContact}
                style={{ paddingHorizontal: 14, paddingVertical: 10 }}
              >
                <Text style={{ color: theme.mint, fontWeight: "700" }}>
                  {savingContact ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
