import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { api } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';

const { width, height } = Dimensions.get('window');

export default function PhotoView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await api.listMedia();
      setItem(all.find((m: any) => m.id === id) || null);
    })();
  }, [id]);

  const del = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await api.deleteMedia(item.id);
      router.back();
    } catch (e) { setDeleting(false); }
  };

  const player = useVideoPlayer(item?.resource_type === 'video' ? item.secure_url : '', p => { p.loop = true; p.play(); });

  if (!item) return <View style={styles.container}><ActivityIndicator color={colors.brandPrimary} style={{ flex: 1 }} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="photo-view">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="photo-close"><Feather name="x" size={24} color={colors.onSurfaceInverse} /></Pressable>
        <Pressable onPress={del} testID="photo-delete" disabled={deleting}>
          {deleting ? <ActivityIndicator color={colors.error} /> : <Feather name="trash-2" size={22} color={colors.error} />}
        </Pressable>
      </View>
      <View style={styles.center}>
        {item.resource_type === 'video' ? (
          <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />
        ) : (
          <Image source={{ uri: item.secure_url }} style={styles.media} contentFit="contain" />
        )}
        {!!item.caption && <Text style={styles.cap}>{item.caption}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  media: { width, height: height * 0.7 },
  cap: { color: colors.onSurfaceInverse, fontFamily: fonts.body, marginTop: spacing.md, paddingHorizontal: spacing.lg, textAlign: 'center' },
});
