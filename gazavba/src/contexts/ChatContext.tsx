import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ChatSessionContextValue = {
  activeChatId: string | null;
  setActiveChat: (chatId: string | null) => void;
};

const ChatSessionContext = createContext<ChatSessionContextValue | undefined>(undefined);

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const setActiveChat = useCallback((chatId: string | null) => {
    setActiveChatId(chatId);
  }, []);

  const value = useMemo(
    () => ({
      activeChatId,
      setActiveChat,
    }),
    [activeChatId, setActiveChat]
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within a ChatSessionProvider");
  }
  return ctx;
}
