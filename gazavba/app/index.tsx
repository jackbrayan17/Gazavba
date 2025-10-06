import { Redirect } from "expo-router";
export default function Index() {
  // Redirige vers l'onglet Chats (tu peux placer une logique d'auth plus tard)
  return <Redirect href="/(tabs)/ChatListScreen" />;
}
