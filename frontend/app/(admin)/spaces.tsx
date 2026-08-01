import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api, clearAuth } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function AdminSpaces() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState('4');
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.listSpaces();
      setSpaces(data);
    } catch (e: any) { console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const create = async () => {
    setError('');
    const n = parseInt(newCount, 10);
    if (!newName.trim()) return setError('Enter a space name');
    if (!n || n < 1 || n > 50) return setError('Members must be 1–50');
    setCreating(true);
    try {
      const res = await api.createSpace(newName.trim(), n);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreateOpen(false);
      setNewName(''); setNewCount('4');
      setCreds(res);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setCreating(false); }
  };

  const del = async (id: string, name: string) => {
    setConfirmDel({ id, name });
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await api.deleteSpace(confirmDel.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setConfirmDel(null);
      load();
    } catch (e: any) { console.warn(e.message); setConfirmDel(null); }
  };

  const logout = async () => { await clearAuth(); router.replace('/login'); };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="admin-spaces">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Spaces</Text>
          <Text style={styles.sub}>{spaces.length} space{spaces.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={logout} testID="admin-logout" style={styles.headerBtn}>
          <Feather name="log-out" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={spaces}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="grid" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>No spaces yet</Text>
              <Text style={styles.emptySub}>Tap + to create your first space.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`space-card-${item.id}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{item.member_count}/{item.max_members} members</Text>
                </View>
                <Pressable testID={`space-delete-${item.id}`} onPress={() => del(item.id, item.name)} style={styles.iconBtn}>
                  <Feather name="trash-2" size={18} color={colors.error} />
                </Pressable>
              </View>
              <View style={styles.membersWrap}>
                {item.members.map((m: any) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.memberDot} />
                    <Text style={styles.memberText}>@{m.username}</Text>
                    {m.must_change_password && <View style={styles.badge}><Text style={styles.badgeText}>new</Text></View>}
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <Pressable testID="admin-create-space" onPress={() => setCreateOpen(true)} style={styles.fab}>
        <Feather name="plus" size={26} color={colors.onBrandPrimary} />
      </Pressable>

      {/* Create modal */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>New Space</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput testID="new-space-name" value={newName} onChangeText={setNewName} placeholder="e.g. Family" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.label}>Number of members</Text>
            <TextInput testID="new-space-count" value={newCount} onChangeText={setNewCount} keyboardType="number-pad" style={styles.input} />
            {!!error && <Text style={styles.error} testID="admin-create-error">{error}</Text>}
            <Pressable testID="new-space-submit" onPress={create} disabled={creating} style={[styles.cta, creating && { opacity: 0.7 }]}>
              {creating ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.ctaText}>Create Space</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Credentials modal */}
      <Modal visible={!!creds} transparent animationType="fade" onRequestClose={() => setCreds(null)}>
        <View style={styles.backdrop} />
        <View style={styles.modalWrap}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>“{creds?.name}” created!</Text>
            <Text style={styles.credHint}>Share these credentials with each member. They must change password on first login.</Text>
            <ScrollView>
              {creds?.members?.map((m: any, i: number) => (
                <View key={i} style={styles.credRow}>
                  <View>
                    <Text style={styles.credLabel}>Username</Text>
                    <Text style={styles.credValue}>{m.username}</Text>
                  </View>
                  <View>
                    <Text style={styles.credLabel}>Password</Text>
                    <Text style={styles.credValue}>{m.password}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable testID="creds-done" onPress={() => setCreds(null)} style={styles.cta}>
              <Text style={styles.ctaText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.onSurface },
  sub: { fontFamily: fonts.body, color: colors.muted, marginTop: 2 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.md },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.onSurface },
  emptySub: { fontFamily: fonts.body, color: colors.muted, textAlign: 'center' },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.onSurface },
  cardMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  iconBtn: { padding: spacing.sm },
  membersWrap: { marginTop: spacing.md, gap: spacing.xs },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
  memberText: { fontFamily: fonts.body, fontSize: 14, color: colors.onSurfaceSecondary },
  badge: { backgroundColor: colors.warning, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { color: colors.onSurface, fontSize: 10, fontFamily: fonts.bodySemi },
  fab: {
    position: 'absolute', bottom: spacing.xl, right: spacing.xl,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: spacing['2xl'] },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.onSurface, marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15,
    fontFamily: fonts.body, color: colors.onSurface,
  },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, marginTop: spacing.sm },
  cta: { marginTop: spacing.lg, backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 15 },
  credHint: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, marginBottom: spacing.md },
  credRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.sm,
  },
  credLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  credValue: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface, marginTop: 2 },
});
