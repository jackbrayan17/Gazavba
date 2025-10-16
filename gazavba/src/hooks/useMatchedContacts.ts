import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Contacts from "expo-contacts";
import ApiService from "../services/api";

export type PermissionState = "unavailable" | "undetermined" | "granted" | "denied";

export type MatchedContact = {
  id: string;
  name: string;
  phone: string;
  avatar?: string | null;
  isOnline?: boolean;
  contactName?: string;
};

export type InviteContact = {
  phone: string;
  name: string;
};

const SUPPORTS_CONTACTS = Platform.OS === "ios" || Platform.OS === "android";

export const normalizePhone = (value?: string | null) =>
  (value ?? "")
    .toString()
    .replace(/[^\d+]/g, "")
    .trim();

const uniquePush = (collection: string[], value: string) => {
  if (!collection.includes(value)) {
    collection.push(value);
  }
};

export function useMatchedContacts(currentUserId?: string | null) {
  const [matches, setMatches] = useState<MatchedContact[]>([]);
  const [invites, setInvites] = useState<InviteContact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<PermissionState>(
    SUPPORTS_CONTACTS ? "undetermined" : "unavailable"
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const syncContacts = useCallback(async () => {
    if (!SUPPORTS_CONTACTS || permissionState !== "granted") {
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      const phoneToName = new Map<string, string>();
      const normalizedNumbers: string[] = [];

      data.forEach((contact) => {
        (contact.phoneNumbers ?? []).forEach((phone) => {
          const normalized = normalizePhone(phone.number);
          if (!normalized) return;
          if (!phoneToName.has(normalized)) {
            phoneToName.set(normalized, contact.name ?? normalized);
          }
          uniquePush(normalizedNumbers, normalized);
        });
      });

      if (normalizedNumbers.length === 0) {
        setMatches([]);
        setInvites([]);
        setLastSyncedAt(Date.now());
        return;
      }

      const response = await ApiService.matchContacts(normalizedNumbers);
      const rawMatches = Array.isArray(response?.matches) ? response.matches : [];
      const rawUnmatched = Array.isArray(response?.unmatched) ? response.unmatched : [];

      const formattedMatches: MatchedContact[] = rawMatches
        .filter((item: any) => item?.id && item.id !== currentUserId)
        .map((item: any) => {
          const normalized = normalizePhone(item?.phone);
          return {
            id: String(item.id),
            name: item?.name ?? item?.phone ?? "",
            phone: normalized,
            avatar: item?.avatar ?? null,
            isOnline: !!item?.isOnline,
            contactName: normalized ? phoneToName.get(normalized) ?? item?.name ?? normalized : item?.name,
          };
        });

      const formattedInvites: InviteContact[] = rawUnmatched
        .map((value: any) => normalizePhone(value))
        .filter((value: string): value is string => Boolean(value))
        .map((phone) => ({
          phone,
          name: phoneToName.get(phone) ?? phone,
        }));

      setMatches(formattedMatches);
      setInvites(formattedInvites);
      setLastSyncedAt(Date.now());
    } catch (err: any) {
      console.error("Failed to match contacts", err);
      setError(err?.message ?? "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, permissionState]);

  useEffect(() => {
    let cancelled = false;

    if (!SUPPORTS_CONTACTS) {
      setPermissionState("unavailable");
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const status = await Contacts.getPermissionsAsync();
        if (cancelled) return;

        if (status.status === "granted") {
          setPermissionState("granted");
          await syncContacts();
        } else if (status.status === "undetermined") {
          setPermissionState("undetermined");
        } else {
          setPermissionState("denied");
        }
      } catch (err) {
        console.error("Unable to read contact permissions", err);
        if (!cancelled) {
          setPermissionState("unavailable");
          setError("Contacts are not available on this device");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syncContacts]);

  const requestAccess = useCallback(async () => {
    if (!SUPPORTS_CONTACTS) {
      setPermissionState("unavailable");
      return false;
    }

    try {
      const status = await Contacts.requestPermissionsAsync();
      if (status.status === "granted") {
        setPermissionState("granted");
        await syncContacts();
        return true;
      }

      setPermissionState(status.canAskAgain ? "undetermined" : "denied");
      return false;
    } catch (err) {
      console.error("Request contact permission failed", err);
      setPermissionState("unavailable");
      return false;
    }
  }, [syncContacts]);

  const refresh = useCallback(async () => {
    if (permissionState !== "granted") {
      return false;
    }
    await syncContacts();
    return true;
  }, [permissionState, syncContacts]);

  const matchIds = useMemo(() => matches.map((item) => item.id), [matches]);
  const matchIdSet = useMemo(() => new Set(matchIds), [matchIds]);

  return {
    matches,
    invites,
    loading,
    error,
    permissionState,
    requestAccess,
    refresh,
    supportsContacts: SUPPORTS_CONTACTS,
    lastSyncedAt,
    matchIds,
    matchIdSet,
  };
}

export default useMatchedContacts;
