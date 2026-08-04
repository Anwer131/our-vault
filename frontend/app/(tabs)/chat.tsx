import { useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api, getUser } from '@/src/api';
import { useNotificationContext } from '@/src/contexts/NotificationContext';
import { colors, spacing, radius, fonts } from '@/src/theme';
import ProfileButton from '@/src/components/ProfileButton';

export default function Chat() {
  const [me, setMe] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);
  const messagesRef = useRef<any[]>([]);  // ref to avoid stale closure in notification effect
  const { notifications } = useNotificationContext();

  const load = async () => {
    try {
      const data = await api.listMessages();
      setMessages(data);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { console.warn(e.message); }
  };

  useFocusEffect(useCallback(() => {
    (async () => { setMe(await getUser()); await load(); })();
    pollRef.current = setInterval(load, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []));

  // Keep ref in sync with state so the notification effect doesn't use stale closure
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Listen for real-time chat notifications
  useEffect(() => {
    const chatNotifs = notifications.filter(n => n.type === 'chat');
    if (chatNotifs.length === 0) return;
    const latest = chatNotifs[chatNotifs.length - 1];
    if (latest.data && !messagesRef.current.some(m => m.id === latest.data.id)) {
      setMessages(prev => {
        if (prev.some(m => m.id === latest.data.id)) return prev;
        return [...prev, latest.data];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [notifications]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const t = text.trim();
    setText('');
    try {
      const msg = await api.sendMessage(t);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { console.warn(e.message); }
    finally { setSending(false); }
  };

  const renderItem = ({ item }: any) => {
    const mine = item.sender_id === me?.id;
    return (
      <View style={[styles.row, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          {!mine && <Text style={styles.sender}>{item.sender_username}</Text>}
          <Text style={styles.msgText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="chat-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <ProfileButton />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Say hello</Text>}
        />
        <View style={styles.inputRow}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable testID="chat-send" onPress={send} style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}>
            <Feather name="send" size={18} color={colors.onSurfaceInverse} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.onSurface },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  row: { marginBottom: spacing.sm, flexDirection: 'row' },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  mine: { backgroundColor: colors.brandTertiary, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: radius.sm },
  sender: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.brandPrimary, marginBottom: 2 },
  msgText: { fontFamily: fonts.body, fontSize: 15, color: colors.onSurface },
  empty: { textAlign: 'center', color: colors.muted, fontFamily: fonts.body, marginTop: spacing['3xl'] },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10, maxHeight: 100,
    fontFamily: fonts.body, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceInverse,
    alignItems: 'center', justifyContent: 'center',
  },
});