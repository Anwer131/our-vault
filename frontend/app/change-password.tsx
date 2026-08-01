import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, setUser, getUser } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function ChangePassword() {
  const router = useRouter();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (newPw.length < 6) return setError('New password must be at least 6 chars');
    if (newPw !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      await api.changePassword(oldPw, newPw);
      const u = await getUser();
      if (u) { u.must_change_password = false; await setUser(u); }
      if (u?.role === 'superadmin') router.replace('/(admin)/spaces');
      else router.replace('/(tabs)/gallery');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Secure Our Vault</Text>
          <Text style={styles.sub}>Please set a new password to continue.</Text>

          <Text style={styles.label}>Current Password</Text>
          <TextInput testID="cp-old" value={oldPw} onChangeText={setOldPw} placeholder="admin123 or welcome123" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} />
          <Text style={styles.label}>New Password</Text>
          <TextInput testID="cp-new" value={newPw} onChangeText={setNewPw} secureTextEntry style={styles.input} />
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput testID="cp-confirm" value={confirm} onChangeText={setConfirm} secureTextEntry style={styles.input} />
          {!!error && <Text style={styles.error} testID="cp-error">{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable testID="cp-submit" style={[styles.cta, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Save</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl },
  title: { fontFamily: fonts.displayBold, fontSize: 32, color: colors.onSurface, marginTop: spacing.md },
  sub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14, fontSize: 16,
    fontFamily: fonts.body, color: colors.onSurface, backgroundColor: colors.surface,
  },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, backgroundColor: colors.surface },
  cta: { backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 16 },
});
