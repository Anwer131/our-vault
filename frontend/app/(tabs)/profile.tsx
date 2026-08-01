import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { api, clearAuth, getUser, setUser } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Profile() {
  const router = useRouter();
  const [u, setU] = useState<any>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const local = await getUser();
    try {
      const fresh = await api.me();
      setU(fresh); await setUser(fresh);
      setName(fresh.name || ''); setNickname(fresh.nickname || ''); setMobile(fresh.mobile || '');
    } catch {
      if (local) { setU(local); setName(local.name); setNickname(local.nickname); setMobile(local.mobile); }
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const updated = await api.updateProfile({ name, nickname, mobile });
      setU(updated); await setUser(updated);
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const logout = async () => {
    await clearAuth();
    router.replace('/login');
  };

  if (!u) return <View style={styles.container} />;

  const initials = (u.name || u.username).slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="profile-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing['3xl'] }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <Text style={styles.name}>{u.name || u.username}</Text>
            <Text style={styles.nick}>@{u.username}{u.nickname ? ` · “${u.nickname}”` : ''}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput testID="profile-name" value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Nickname</Text>
            <TextInput testID="profile-nickname" value={nickname} onChangeText={setNickname} style={styles.input} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput testID="profile-mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" style={styles.input} placeholderTextColor={colors.muted} />
            <Text style={styles.label}>Username</Text>
            <View style={[styles.input, styles.disabled]}><Text style={styles.disabledText}>{u.username}</Text></View>

            {!!msg && <Text style={[styles.msg, msg === 'Saved!' && { color: colors.success }]}>{msg}</Text>}
            <Pressable testID="profile-save" onPress={save} style={[styles.saveBtn, saving && { opacity: 0.7 }]}>
              {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>

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
  header: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarText: { fontFamily: fonts.displayBold, color: colors.onBrandPrimary, fontSize: 32 },
  name: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.onSurface },
  nick: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onSurface, marginBottom: spacing.sm },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15,
    fontFamily: fonts.body, color: colors.onSurface, backgroundColor: colors.surface,
  },
  disabled: { backgroundColor: colors.surfaceSecondary, justifyContent: 'center' },
  disabledText: { color: colors.onSurfaceSecondary, fontFamily: fonts.body, fontSize: 15 },
  msg: { fontFamily: fonts.bodyMedium, marginTop: spacing.sm, color: colors.error },
  saveBtn: {
    marginTop: spacing.lg, backgroundColor: colors.surfaceInverse,
    borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center',
  },
  saveText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 15 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
  },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface },
  logoutBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: 'center',
  },
  logoutText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.error },
});
