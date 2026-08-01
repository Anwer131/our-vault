import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, setToken, setUser } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!username || !password) { setError('Enter both fields'); return; }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      await setToken(res.token);
      await setUser(res.user);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (res.user.must_change_password) router.replace('/change-password');
      else router.replace('/(tabs)/gallery');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1765498173413-b428f5d0a17e?crop=entropy&cs=srgb&fm=jpg&w=800&q=85' }}
              style={styles.hero}
              contentFit="cover"
            />
          </View>
          <Text style={styles.title}>DuoVault</Text>
          <Text style={styles.subtitle}>A private scrapbook for two.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              testID="login-username-input"
              value={username}
              onChangeText={setUsername}
              placeholder="user1"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
            {!!error && <Text style={styles.error} testID="login-error">{error}</Text>}
            <Text style={styles.hint}>Default: user1 / user2  |  password: changeme</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable testID="login-submit-button" style={[styles.cta, loading && { opacity: 0.7 }]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Enter</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['2xl'] },
  heroWrap: { alignItems: 'center', marginTop: spacing.lg },
  hero: { width: 200, height: 200, borderRadius: radius.lg },
  title: { fontFamily: fonts.displayBold, fontSize: 44, color: colors.onSurface, textAlign: 'center', marginTop: spacing.lg },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.onSurfaceSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing['2xl'] },
  form: { gap: spacing.sm },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14, fontSize: 16,
    fontFamily: fonts.body, color: colors.onSurface, backgroundColor: colors.surface,
  },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, marginTop: spacing.md, fontSize: 13 },
  hint: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.lg, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, backgroundColor: colors.surface },
  cta: {
    backgroundColor: colors.surfaceInverse, borderRadius: radius.pill,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 16, letterSpacing: 0.3 },
});
