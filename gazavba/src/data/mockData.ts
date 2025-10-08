export type User = {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
};

export type ChatSummary = {
  id: string; // same as user id for one-to-one chats
  userId: string;
  last: string;
  time: string;
  unreadCount: number;
};

export type Message = {
  id: string;
  chatId: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
};

export type Status = {
  id: string;
  owner: string; // "me" or contact name
  mediaType: "image" | "video" | "text";
  mediaUri?: string; // for image/video
  text?: string;     // for text status
  time: string;
  viewed: boolean;
};

export const users: User[] = [
  { id: "1", name: "Brenda", avatar: "https://i.pravatar.cc/120?img=3", isOnline: true },
  { id: "2", name: "Marcus", avatar: "https://i.pravatar.cc/120?img=5", isOnline: false },
  { id: "3", name: "Elena",  avatar: "https://i.pravatar.cc/120?img=2", isOnline: true }
];

export const chats: ChatSummary[] = [
  { id: "1", userId: "1", last: "Hey! How’s Gazavba?", time: "10:12", unreadCount: 2 },
  { id: "2", userId: "2", last: "Let’s meet at 4PM!",   time: "09:34", unreadCount: 0 },
  { id: "3", userId: "3", last: "🔥🔥🔥",                time: "Yesterday", unreadCount: 1 }
];

export const messages: Message[] = [
  { id: "m1", chatId: "1", fromMe: false, text: "Hey, how are you?",        timestamp: Date.now() - 1000 * 60 * 60 },
  { id: "m2", chatId: "1", fromMe: true,  text: "Great! Building Gazavba 🚀", timestamp: Date.now() - 1000 * 60 * 55 },
  { id: "m3", chatId: "1", fromMe: false, text: "Let’s ship it.",           timestamp: Date.now() - 1000 * 60 * 40 },

  { id: "m4", chatId: "2", fromMe: false, text: "Let’s meet at 4PM!",       timestamp: Date.now() - 1000 * 60 * 30 },

  { id: "m5", chatId: "3", fromMe: false, text: "🔥🔥🔥",                   timestamp: Date.now() - 1000 * 60 * 10 }
];

export const statuses: Status[] = [
  { id: "s1", owner: "Brenda", mediaType: "image", mediaUri: "https://picsum.photos/800/1300?1", time: "1 minute ago", viewed: false },
  { id: "s2", owner: "Marcus", mediaType: "image", mediaUri: "https://picsum.photos/800/1300?2", time: "20 minutes ago", viewed: true },
  { id: "s3", owner: "Elena",  mediaType: "text",  text: "Shipping soon!",                               time: "28 minutes ago", viewed: false }
];

export function getUserById(userId: string): User | undefined {
  return users.find(u => u.id === userId);
}

export function getChatById(chatId: string): (ChatSummary & { user: User }) | undefined {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return undefined;
  const user = getUserById(chat.userId);
  if (!user) return undefined;
  return { ...chat, user };
}

export function getMessagesForChat(chatId: string): Message[] {
  return messages.filter(m => m.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);
}

export function getUnreadChatsCount(): number {
  return chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

export function getUnseenStatusCount(): number {
  return statuses.filter(s => s.owner !== "me" && !s.viewed).length;
}

export function addStatusMedia(owner: "me", mediaType: "image" | "video", mediaUri: string) {
  statuses.unshift({ id: "me-" + Date.now(), owner, mediaType, mediaUri, time: "Just now", viewed: false });
}

export function addStatusText(owner: "me", text: string) {
  statuses.unshift({ id: "me-" + Date.now(), owner, mediaType: "text", text, time: "Just now", viewed: false });
}

export function markStatusViewed(id: string) {
  const s = statuses.find(x => x.id === id);
  if (s) s.viewed = true;
}
