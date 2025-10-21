import * as Notifications from "expo-notifications";
import { AppState } from "react-native";

export type IncomingMessageNotification = {
  chatId: string;
  chatName?: string | null;
  text?: string | null;
  senderName?: string | null;
};

class NotificationService {
  private initialized = false;
  private mutedChats = new Set<string>();

  async initialize() {
    if (this.initialized) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }

    this.initialized = true;
  }

  setMuted(chatId: string, muted: boolean) {
    if (!chatId) return;
    if (muted) {
      this.mutedChats.add(chatId);
    } else {
      this.mutedChats.delete(chatId);
    }
  }

  syncMuted(chats: Array<{ id: string; isMuted?: boolean; muteUntil?: string | null }>) {
    const now = Date.now();
    this.mutedChats.clear();
    chats.forEach((chat) => {
      const muted = !!chat.isMuted;
      const until = chat.muteUntil ? new Date(chat.muteUntil).getTime() : null;
      if (muted || (until && until > now)) {
        this.mutedChats.add(chat.id);
      }
    });
  }

  async setAppBadge(count: number) {
    try {
      await Notifications.setBadgeCountAsync(Math.max(0, count));
    } catch (error) {
      console.warn("Failed to set badge count", error);
    }
  }

  async notifyIncomingMessage(payload: IncomingMessageNotification & { activeChatId?: string | null }) {
    await this.initialize();
    const { chatId, chatName, text, senderName, activeChatId } = payload;
    if (!chatId || this.mutedChats.has(chatId)) {
      return;
    }

    const appState = AppState.currentState;
    const isForeground = appState === "active";
    const isViewingChat = activeChatId && activeChatId === chatId;

    if (isForeground && isViewingChat) {
      return;
    }

    const title = senderName ? `${senderName}${chatName ? ` • ${chatName}` : ""}` : chatName || "New message";
    const body = text && text.trim().length > 0 ? text : "You received a new message";

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { chatId },
          sound: "default",
        },
        trigger: null,
      });
    } catch (error) {
      console.warn("Failed to schedule notification", error);
    }
  }
}

export default new NotificationService();
