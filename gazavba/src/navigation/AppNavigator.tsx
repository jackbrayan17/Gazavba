import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatsScreen from '../screens/ChatsScreen';
import StatusScreen from '../screens/StatusScreen';
import ProfileView from '../screens/ProfileView';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

// Color palette – WhatsApp inspired
const colors = {
  active: '#25D366',
  inactive: '#8e8e8e',
  background: '#ffffff',
};

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
          elevation: 5,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Chats: 'chatbubbles-outline',
            Status: 'aperture-outline',
            Profile: 'person-circle-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Status" component={StatusScreen} />
      <Tab.Screen name="Profile" component={ProfileView} />
    </Tab.Navigator>
  );
}
