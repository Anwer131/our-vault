import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { colors, fonts } from '@/src/theme';
import CreateSheet from '@/src/components/CreateSheet';

export default function TabsLayout() {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.onSurface,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
            borderTopWidth: 1,
            height: 72,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
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
        <Tabs.Screen name="create"
          options={{
            title: 'Create',
            tabBarIcon: ({ color }) => (
              <View style={styles.plusBubble}>
                <Feather name="plus" size={22} color={colors.onBrandPrimary} />
              </View>
            ),
            tabBarButton: (props: any) => (
              <Pressable testID="tab-create" {...props} onPress={() => setSheetOpen(true)} />
            ),
          }}
        />
        <Tabs.Screen name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
            tabBarButtonTestID: 'tab-profile',
          }}
        />
      </Tabs>
      <CreateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpload={() => { setSheetOpen(false); router.push('/upload'); }}
        onScribble={() => { setSheetOpen(false); router.push('/scribble'); }}
        onAI={() => { setSheetOpen(false); router.push('/ai-studio'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plusBubble: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceInverse,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
});
