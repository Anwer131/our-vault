import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, getUser } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';
import ProfileButton from '@/src/components/ProfileButton';

const { width } = Dimensions.get('window');
const GAP = spacing.sm;
const COL = 2;
const TILE = (width - spacing.lg * 2 - GAP) / COL;

export default function Gallery() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [spaceName, setSpaceName] = useState('');

  const load = async () => {
    try {
      const u = await getUser();
      setSpaceName(u?.space_name || '');
      const data = await api.listMedia();
      setItems(data);
    } catch (e: any) { console.warn(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const enterSelect = (id?: string) => {
    setSelectMode(true);
    if (id) setSelected([id]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const exitSelect = () => { setSelectMode(false); setSelected([]); };

  const bulkDelete = async () => {
    if (!selected.length) return;
    try { await api.deleteMany(selected); exitSelect(); load(); }
    catch (e: any) { console.warn(e.message); }
  };

  const bulkAI = () => {
    if (!selected.length) return;
    router.push({ pathname: '/(tabs)/ai', params: { ids: selected.join(',') } });
    exitSelect();
  };

  const renderItem = ({ item, index }: any) => {
    const isSelected = selected.includes(item.id);
    const h = TILE * (index % 3 === 0 ? 1.15 : index % 3 === 1 ? 0.85 : 1);
    return (
      <Pressable
        testID={`gallery-item-${item.id}`}
        onPress={() => selectMode ? toggle(item.id) : router.push({ pathname: '/photo-view', params: { id: item.id } })}
        onLongPress={() => !selectMode && enterSelect(item.id)}
        style={[styles.card, { height: h, marginBottom: GAP, borderRadius: index % 2 === 0 ? radius.md : radius.lg }]}
      >
        {item.resource_type === 'video' ? (
          <View style={styles.videoWrap}>
            <Image source={{ uri: item.secure_url.replace('/upload/', '/upload/so_0/').replace(/\.[a-z0-9]+$/, '.jpg') }} style={styles.imgFill} contentFit="cover" />
            <View style={styles.playIcon}><Feather name="play" size={22} color={colors.onSurfaceInverse} /></View>
          </View>
        ) : (
          <Image source={{ uri: item.secure_url }} style={styles.imgFill} contentFit="cover" />
        )}
        {item.is_ai && (
          <View style={styles.aiTag}>
            <Feather name="zap" size={10} color={colors.onSurfaceInverse} />
            <Text style={styles.aiTagText}>AI</Text>
          </View>
        )}
        {selectMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
            {isSelected && <Feather name="check" size={14} color={colors.onSurfaceInverse} />}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="gallery-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.spaceLabel} testID="gallery-space-name">{spaceName || 'Your Space'}</Text>
          <Text style={styles.sub}>{items.length} {items.length === 1 ? 'memory' : 'memories'}</Text>
        </View>
        {items.length > 0 && (
          selectMode ? (
            <Pressable testID="gallery-cancel-select" onPress={exitSelect} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Done</Text>
            </Pressable>
          ) : (
            <Pressable testID="gallery-enter-select" onPress={() => setSelectMode(true)} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Select</Text>
            </Pressable>
          )
        )}
        <View style={{ marginLeft: spacing.sm }}>
          <ProfileButton />
        </View>
      </View>

      <Pressable testID="gallery-upload-btn" onPress={() => router.push('/upload')} style={styles.uploadBar}>
        <Feather name="plus" size={18} color={colors.onSurfaceInverse} />
        <Text style={styles.uploadBarText}>Add Photos / Videos</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="book-open" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Start your scrapbook</Text>
          <Text style={styles.emptySub}>Tap “Add Photos / Videos” above.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          numColumns={COL}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: selectMode ? 130 : spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        />
      )}

      {selectMode && selected.length > 0 && (
        <View style={styles.actionBar} testID="gallery-action-bar">
          <Text style={styles.selCount}>{selected.length} selected</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable testID="gallery-delete" onPress={bulkDelete} style={[styles.actionBtn, { backgroundColor: colors.error }]}>
              <Feather name="trash-2" size={16} color={colors.onError} />
              <Text style={[styles.actionText, { color: colors.onError }]}>Delete</Text>
            </Pressable>
            <Pressable testID="gallery-ai-create" onPress={bulkAI} style={[styles.actionBtn, { backgroundColor: colors.surfaceInverse }]}>
              <Feather name="zap" size={16} color={colors.onSurfaceInverse} />
              <Text style={[styles.actionText, { color: colors.onSurfaceInverse }]}>Create with AI</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  spaceLabel: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.onSurface },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  headerBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  headerBtnText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.onSurface },
  uploadBar: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surfaceInverse, borderRadius: radius.pill,
    paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadBarText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.onSurface },
  emptySub: { fontFamily: fonts.body, color: colors.onSurfaceSecondary, textAlign: 'center' },
  card: { width: TILE, backgroundColor: colors.surfaceSecondary, overflow: 'hidden' },
  imgFill: { width: '100%', height: '100%' },
  videoWrap: { width: '100%', height: '100%' },
  playIcon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  aiTag: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.surfaceInverse, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  aiTagText: { color: colors.onSurfaceInverse, fontSize: 10, fontFamily: fonts.bodySemi },
  checkbox: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.onSurfaceInverse, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  actionBar: {
    position: 'absolute', bottom: 90, left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border,
  },
  selCount: { fontFamily: fonts.bodySemi, color: colors.onSurface },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
