import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api, clearAuth, getUser, setUser } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Profile() {
  const router = useRouter();
  const [u, setU] = useState<any>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [nickDrafts, setNickDrafts] = useState<Record<string, string>>({});
  const [savingNick, setSavingNick] = useState<string>('');

  const load = async () => {
    try {
      const fresh = await api.me();
      setU(fresh); await setUser(fresh);
      setName(fresh.name || ''); setMobile(fresh.mobile || '');
      const mems = await api.spaceMembers();
      setMembers(mems);
      const drafts: Record<string, string> = {};
      mems.forEach((m: any) => { if (m.id !== fresh.id) drafts[m.id] = m.nickname || ''; });
      setNickDrafts(drafts);
    } catch (e: any) {
      const local = await getUser();
      if (local) { setU(local); setName(local.name); setMobile(local.mobile); }
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const updated = await api.updateProfile({ name, mobile });
      setU(updated); await setUser(updated);
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const saveNick = async (targetId: string) => {
    setSavingNick(targetId);
    try {
      await api.setNickname(targetId, nickDrafts[targetId] || '');
      const mems = await api.spaceMembers();
      setMembers(mems);
    } catch (e: any) { console.warn(e.message); }
    finally { setSavingNick(''); }
  };

  const logout = async () => { await clearAuth(); router.replace('/login'); };

  if (!u) return <View style={styles.container} />;
  const initials = (u.name || u.username).slice(0, 2).toUpperCase();
  const others = members.filter(m => m.id !== u.id);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="profile-screen">
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} testID="profile-back" style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Profile</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing['3xl'] }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <Text style={styles.name}>{u.name || u.username}</Text>
            <Text style={styles.nick}>@{u.username}{u.space_name ? ` · ${u.space_name}` : ''}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput testID="profile-name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput testID="profile-mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" style={styles.input} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Username</Text>
            <View style={[styles.input, styles.disabled]}><Text style={styles.disabledText}>{u.username}</Text></View>
            {!!msg && <Text style={[styles.msg, msg === 'Saved!' && { color: colors.success }]}>{msg}</Text>}
            <Pressable testID="profile-save" onPress={save} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
              {saving ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>

          {others.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nicknames for Others</Text>
              <Text style={styles.hint}>Only you see these — a private nickname for each member of your space.</Text>
              {others.map((m: any) => (
                <View key={m.id} style={styles.nickCard} testID={`nick-row-${m.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
                    <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{(m.name || m.username).slice(0, 2).toUpperCase()}</Text></View>
                    <View>
                      <Text style={styles.memberName}>{m.name || m.username}</Text>
                      <Text style={styles.memberHandle}>@{m.username}</Text>
                    </View>
                  </View>
                  <TextInput
                    testID={`nick-input-${m.id}`}
                    value={nickDrafts[m.id] || ''}
                    onChangeText={(v) => setNickDrafts({ ...nickDrafts, [m.id]: v })}
                    placeholder="e.g. Sunny"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  <Pressable testID={`nick-save-${m.id}`} onPress={() => saveNick(m.id)} style={styles.nickSave} disabled={savingNick === m.id}>
                    {savingNick === m.id ? <ActivityIndicator size="small" color={colors.onSurfaceInverse} /> :
                      <Text style={styles.nickSaveText}>{m.nickname ? 'Update' : 'Set nickname'}</Text>}
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Pressable testID="profile-change-password" onPress={() => router.push('/change-password')} style={styles.linkRow}>
              <Feather name="lock" size={18} color={colors.onSurfaceSecondary} />
              <Text style={styles.linkText}>Change Password</Text>
              <Feather name="chevron-right" size={18} color={colors.muted} style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <Pressable testID="profile-logout" onPress={logout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  topTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.onSurface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { fontFamily: fonts.displayBold, color: colors.onBrandPrimary, fontSize: 32 },
  name: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.onSurface },
  nick: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, fontFamily: fonts.body, color: colors.onSurface, backgroundColor: colors.surface },
  disabled: { backgroundColor: colors.surfaceSecondary, justifyContent: 'center' },
  disabledText: { color: colors.onSurfaceSecondary, fontFamily: fonts.body, fontSize: 15 },
  msg: { fontFamily: fonts.bodyMedium, marginTop: spacing.sm, color: colors.error },
  saveBtn: { marginTop: spacing.lg, backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 15 },
  nickCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { fontFamily: fonts.bodySemi, color: colors.onBrandPrimary, fontSize: 14 },
  memberName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface },
  memberHandle: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  nickSave: { marginTop: spacing.sm, alignSelf: 'flex-end', backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  nickSaveText: { color: colors.onBrandPrimary, fontFamily: fonts.bodySemi, fontSize: 13 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface },
  logoutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.error },
});
