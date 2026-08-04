import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNotificationContext } from '@/src/contexts/NotificationContext';
import { colors, spacing, radius, fonts } from '@/src/theme';

export function NotificationToast() {
  const { notifications, dismiss } = useNotificationContext();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [show, setShow] = useState(false);
  const opacity = useState(new Animated.Value(0))[0];

  const current = notifications[currentIdx];

  useEffect(() => {
    if (notifications.length > 0 && currentIdx < notifications.length) {
      setShow(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, notifications.length]);

  const handleDismiss = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShow(false);
      if (current) {
        dismiss(current.id);
      }
      setCurrentIdx(prev => prev + 1);
    });
  };

  if (!show || !current) return null;

  const isChat = current.type === 'chat';

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Pressable onPress={handleDismiss} style={styles.toast}>
        <View style={[styles.icon, { backgroundColor: isChat ? colors.brand : colors.brandSecondary }]}>
          <Feather name={isChat ? 'message-circle' : 'image'} size={16} color={colors.onBrandPrimary} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{current.body}</Text>
        </View>
        <Feather name="x" size={16} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.onSurface,
    marginBottom: 2,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    flexWrap: 'wrap',
  },
});