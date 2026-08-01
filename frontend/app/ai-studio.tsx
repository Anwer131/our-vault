import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function AIStudio() {
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const [media, setMedia] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>(ids ? ids.split(',') : []);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const data = await api.listMedia();
        setMedia(data.filter((m: any) => m.resource_type === 'image'));
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []));

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const generate = async () => {
    if (!prompt.trim()) { setError('Please describe what you want to create'); return; }
    if (!selected.length) { setError('Select at least one photo'); return; }
    setError(''); setGenerating(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api.aiGenerate(prompt, selected);
      setResult(res);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message || 'Generation failed');
    } finally { setGenerating(false); }
  };

  const selectedItems = media.filter(m => selected.includes(m.id));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="ai-studio-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="ai-back"><Feather name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>AI Studio</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Source Photos ({selected.length})</Text>
          {loading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} />
          ) : media.length === 0 ? (
            <Text style={styles.hint}>Upload photos to your gallery first.</Text>
          ) : (
            <>
              {selectedItems.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
                  {selectedItems.map(m => (
                    <View key={m.id} style={styles.selectedPhoto}>
                      <Image source={{ uri: m.secure_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    </View>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.hintSm}>Tap photos to include:</Text>
              <View style={styles.grid}>
                {media.map(m => {
                  const on = selected.includes(m.id);
                  return (
                    <Pressable key={m.id} testID={`ai-pick-${m.id}`} onPress={() => toggle(m.id)} style={[styles.thumb, on && styles.thumbOn]}>
                      <Image source={{ uri: m.secure_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      {on && <View style={styles.check}><Feather name="check" size={14} color={colors.onSurfaceInverse} /></View>}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Your Prompt</Text>
          <TextInput
            testID="ai-prompt"
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Turn us into watercolor portraits under a starry sky"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.prompt}
          />
          {!!error && <Text style={styles.error} testID="ai-error">{error}</Text>}

          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>✨ Created</Text>
              <Image source={{ uri: result.secure_url }} style={styles.resultImg} contentFit="cover" />
              <Text style={styles.resultCap}>{result.caption}</Text>
              <Pressable testID="ai-view-in-gallery" onPress={() => router.replace('/(tabs)/gallery')} style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View in Gallery</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            testID="ai-generate"
            style={[styles.cta, (generating || !selected.length || !prompt.trim()) && { opacity: 0.6 }]}
            onPress={generate}
            disabled={generating || !selected.length || !prompt.trim()}
          >
            {generating ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <ActivityIndicator color={colors.onSurfaceInverse} />
                <Text style={styles.ctaText}>Creating…</Text>
              </View>
            ) : (
              <>
                <Feather name="zap" size={16} color={colors.onSurfaceInverse} />
                <Text style={styles.ctaText}>Magic</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.onSurface },
  sectionLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.onSurfaceSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  hint: { fontFamily: fonts.body, color: colors.muted, marginVertical: spacing.lg },
  hintSm: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
  selectedPhoto: { width: 90, height: 90, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.brandPrimary },
  check: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  prompt: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, minHeight: 100, textAlignVertical: 'top',
    fontFamily: fonts.body, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface,
  },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, marginTop: spacing.md },
  resultCard: {
    marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, alignItems: 'center', gap: spacing.md,
  },
  resultLabel: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.onSurface },
  resultImg: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surface },
  resultCap: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, textAlign: 'center' },
  viewBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 12 },
  viewBtnText: { color: colors.onBrandPrimary, fontFamily: fonts.bodySemi },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  cta: { backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 15 },
});
