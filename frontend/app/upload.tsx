import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api, uploadToCloudinary } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

export default function Upload() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [msg, setMsg] = useState('');

  const pick = async (multi: boolean) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setMsg('Permission required to access media'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: multi,
      selectionLimit: multi ? 0 : 1,
      quality: 1,
    });
    if (res.canceled) return;
    setAssets(prev => [...prev, ...res.assets]);
  };

  const upload = async () => {
    if (!assets.length) return;
    setUploading(true); setMsg('');
    setProgress({ done: 0, total: assets.length });
    const successful: any[] = [];
    for (let i = 0; i < assets.length; i++) {
      try {
        const cloud = await uploadToCloudinary(assets[i]);
        successful.push({
          public_id: cloud.public_id,
          secure_url: cloud.secure_url,
          resource_type: cloud.resource_type,
          format: cloud.format,
          width: cloud.width,
          height: cloud.height,
          duration: cloud.duration ?? null,
        });
      } catch (e: any) {
        console.warn('upload fail', e.message);
      }
      setProgress({ done: i + 1, total: assets.length });
    }
    if (successful.length) {
      try { await api.saveMedia(successful); } catch (e: any) { setMsg('Saved to cloud but failed to persist: ' + e.message); }
    }
    setUploading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/gallery');
  };

  const remove = (idx: number) => setAssets(assets.filter((_, i) => i !== idx));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="upload-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="upload-back"><Feather name="arrow-left" size={22} color={colors.onSurface} /></Pressable>
        <Text style={styles.title}>Upload</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.pickRow}>
          <Pressable testID="pick-single" style={styles.pickBtn} onPress={() => pick(false)}>
            <Feather name="image" size={20} color={colors.onSurface} />
            <Text style={styles.pickText}>Single</Text>
          </Pressable>
          <Pressable testID="pick-multi" style={styles.pickBtn} onPress={() => pick(true)}>
            <Feather name="grid" size={20} color={colors.onSurface} />
            <Text style={styles.pickText}>Multiple</Text>
          </Pressable>
        </View>

        {assets.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="upload-cloud" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>Pick photos or videos to upload</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {assets.map((a, i) => (
              <View key={i} style={styles.previewWrap}>
                <Image source={{ uri: a.uri }} style={styles.preview} contentFit="cover" />
                <Pressable style={styles.rm} onPress={() => remove(i)} testID={`upload-remove-${i}`}>
                  <Feather name="x" size={14} color={colors.onSurfaceInverse} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {!!msg && <Text style={styles.msg}>{msg}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="upload-submit"
          style={[styles.cta, (!assets.length || uploading) && { opacity: 0.5 }]}
          disabled={!assets.length || uploading}
          onPress={upload}
        >
          {uploading ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ActivityIndicator color={colors.onSurfaceInverse} />
              <Text style={styles.ctaText}>Uploading {progress.done}/{progress.total}</Text>
            </View>
          ) : (
            <Text style={styles.ctaText}>Upload {assets.length || ''}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.onSurface },
  pickRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  pickBtn: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  pickText: { fontFamily: fonts.bodySemi, color: colors.onSurface },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md },
  emptyText: { fontFamily: fonts.body, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewWrap: { width: 100, height: 100, borderRadius: radius.md, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  rm: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  msg: { color: colors.error, fontFamily: fonts.bodyMedium, marginTop: spacing.md },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface },
  cta: { backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 15 },
});
