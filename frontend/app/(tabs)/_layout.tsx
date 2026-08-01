import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: 74,
          paddingBottom: 14,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color }) => <Feather name="image" size={22} color={color} />,
          tabBarButtonTestID: 'tab-gallery',
        }}
      />
      <Tabs.Screen name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} />,
          tabBarButtonTestID: 'tab-chat',
        }}
      />
      <Tabs.Screen name="scribble"
        options={{
          title: 'Scribble',
          tabBarIcon: ({ color }) => <Feather name="edit-3" size={22} color={color} />,
          tabBarButtonTestID: 'tab-scribble',
        }}
      />
      <Tabs.Screen name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} />,
          tabBarButtonTestID: 'tab-ai',
        }}
      />
      {/* Profile is not a tab — accessed via top-right icon */}
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
