import { useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Text, TouchableOpacity, View, TextInput, Share, Alert, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../src/contexts/AuthContext";
import ApiService from "../../src/services/api";
import { ThemeCtx } from "../_layout";
import { resolveAssetUri } from "../../src/utils/resolveAssetUri";

const INVITE_LINK = "https://gazavba.app/download";

const normalizePhone = (value: string | undefined | null) => (value ?? "").replace(/[^\d+]/g, "").trim();

type DeviceContact = {
  name: string;
  phone: string;
};

type MatchedContact = {
  id: string;
  name: string;
  avatar?: string | null;
  phone: string;
  isOnline?: boolean;
  contactName?: string;
};

export default function ContactsScreen() {
  const theme = useContext(ThemeCtx);
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [matchedContacts, setMatchedContacts] = useState<MatchedContact[]>([]);
  const [inviteContacts, setInviteContacts] = useState<DeviceContact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      const phoneToNames = new Map<string, string>();
      const normalizedNumbers: string[] = [];

      data.forEach((contact) => {
        (contact.phoneNumbers || []).forEach((phone) => {
          const normalized = normalizePhone(phone.number);
          if (!normalized) return;
          if (!phoneToNames.has(normalized)) {
            phoneToNames.set(normalized, contact.name ?? normalized);
            normalizedNumbers.push(normalized);
          }
        });
      });

      if (normalizedNumbers.length === 0) {
        setMatchedContacts([]);
        setInviteContacts([]);
        return;
      }

      const response = await ApiService.matchContacts(normalizedNumbers);
      const matches = Array.isArray(response?.matches) ? response.matches : [];
      const unmatched = Array.isArray(response?.unmatched) ? response.unmatched : [];

      const formattedMatches: MatchedContact[] = matches
        .filter((item: any) => item.id !== user?.id)
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          avatar: item.avatar,
          phone: item.phone,
          isOnline: item.isOnline,
          contactName: phoneToNames.get(normalizePhone(item.phone)) || item.name,
        }));

      const formattedInvites: DeviceContact[] = unmatched.map((phone: string) => ({
        phone,
        name: phoneToNames.get(phone) || phone,
      }));

      setMatchedContacts(formattedMatches);
      setInviteContacts(formattedInvites);
    } catch (error) {
      console.error("Failed to load contacts", error);
      Alert.alert("Error", "Unable to load your contacts. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matchedContacts;
    const term = searchQuery.trim().toLowerCase();
    return matchedContacts.filter((item) =>
      item.name.toLowerCase().includes(term) || item.contactName?.toLowerCase().includes(term)
    );
  }, [matchedContacts, searchQuery]);

  const filteredInvites = useMemo(() => {
    if (!searchQuery.trim()) return inviteContacts;
    const term = searchQuery.trim().toLowerCase();
    return inviteContacts.filter((item) =>
      item.name.toLowerCase().includes(term) || item.phone.toLowerCase().includes(term)
    );
  }, [inviteContacts, searchQuery]);

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

  const handleInvite = async (contact: DeviceContact) => {
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
        [Contacts.Fields.PhoneNumbers]: [{ label: 'mobile', number: phone }],
      } as any);
      setAddVisible(false);
      setNewContactName("");
      setNewContactPhone("");
      await loadContacts();
    } catch (error) {
      console.error("Failed to add contact", error);
      Alert.alert("Error", "Could not save the contact on your device.");
    } finally {
      setSavingContact(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (permissionDenied) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Ionicons name="alert-circle" size={36} color={theme.subtext} />
        <Text style={{ marginTop: 12, fontWeight: "700", color: theme.text, fontSize: 16 }}>Allow contact access</Text>
        <Text style={{ marginTop: 8, color: theme.subtext, textAlign: "center" }}>
          Enable contact permissions in your device settings so Gazavba can connect you with friends already using the app.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary, marginBottom: 12 }}>Contacts</Text>

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
            marginBottom: 12,
          }}
        >
          <Ionicons name="person-add" size={18} color={theme.accent} />
          <Text style={{ marginLeft: 8, color: theme.text, fontWeight: "600" }}>Add Contact</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.hairline, paddingHorizontal: 12, height: 44, marginBottom: 20 }}>
          <Ionicons name="search" size={18} color={theme.subtext} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search contacts"
            placeholderTextColor={theme.subtext}
            style={{ flex: 1, color: theme.text, fontSize: 16, marginLeft: 8 }}
          />
        </View>

        <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 8, fontWeight: "700" }}>On Gazavba</Text>
        <FlatList
          data={filteredMatches}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleContactPress(item)}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.hairline, marginBottom: 12 }}
            >
              <Image
                source={{ uri: resolveAssetUri(item.avatar) || "https://ui-avatars.com/api/?background=0C3B2E&color=fff&name=G" }}
                style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 16, color: theme.text }}>{item.contactName || item.name}</Text>
                <Text style={{ color: theme.subtext, marginTop: 2 }}>{item.isOnline ? "Online" : "Offline"}</Text>
              </View>
              <Ionicons name="chatbubble-ellipses" size={20} color={theme.accent} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ color: theme.subtext }}>None of your contacts are on Gazavba yet.</Text>
            </View>
          }
        />

        <Text style={{ color: theme.subtext, fontSize: 13, marginBottom: 8, fontWeight: "700", marginTop: 16 }}>Invite to Gazavba</Text>
        <FlatList
          data={filteredInvites}
          keyExtractor={(i) => `${i.phone}`}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.hairline, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.hairline, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="person-add" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", fontSize: 16, color: theme.text }}>{item.name}</Text>
                <Text style={{ color: theme.subtext, marginTop: 2 }}>{item.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => handleInvite(item)} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.mint, borderRadius: 10, marginRight: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Invite</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCopyLink} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.hairline }}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>Copy</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ color: theme.subtext }}>Everyone from your contacts is already here!</Text>
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
                <Text style={{ color: theme.mint, fontWeight: "700" }}>{savingContact ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
