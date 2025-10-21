import { useEffect } from "react";
import SocketService from "../services/socket";
import NotificationService from "../services/notificationService";
import { useAuth } from "../contexts/AuthContext";
import { useChatSession } from "../contexts/ChatContext";

export default function useSocketNotifications() {
  const { user } = useAuth();
  const { activeChatId } = useChatSession();

  useEffect(() => {
    const handleNewMessage = (payload: any) => {
      const { chatId, message, chatName } = payload || {};
      if (!message || message.senderId === user?.id) {
        return;
      }

      NotificationService.notifyIncomingMessage({
        chatId,
        chatName,
        text: message.text,
        senderName: message.senderName,
        activeChatId,
      });
    };

    NotificationService.initialize().catch(() => {});
    SocketService.on("new_message", handleNewMessage);

    return () => {
      SocketService.off("new_message", handleNewMessage);
    };
  }, [activeChatId, user?.id]);
}
