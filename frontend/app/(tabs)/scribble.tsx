import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api, uploadBase64ToCloudinary } from '@/src/api';
import { colors, spacing, radius, fonts } from '@/src/theme';
import ProfileButton from '@/src/components/ProfileButton';

type Stroke = { d: string; color: string; width: number };
const COLORS = [colors.onSurface, colors.brandPrimary, colors.error, colors.warning, '#5B7BAF', '#D08770'];

export default function Scribble() {
  const router = useRouter();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [color, setColor] = useState(colors.onSurface);
  const [width, setWidth] = useState(4);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const canvasRef = useRef<View>(null);
  const currentRef = useRef('');

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const d = `M${locationX.toFixed(2)},${locationY.toFixed(2)}`;
      currentRef.current = d;
      setCurrent(d);
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      currentRef.current += ` L${locationX.toFixed(2)},${locationY.toFixed(2)}`;
      setCurrent(currentRef.current);
    },
    onPanResponderRelease: () => {
      if (currentRef.current) {
        const finished = { d: currentRef.current, color, width };
        setStrokes(prev => [...prev, finished]);
      }
      currentRef.current = '';
      setCurrent('');
    },
  })).current;

  const undo = () => setStrokes(prev => prev.slice(0, -1));
  const clear = () => { setStrokes([]); setCurrent(''); };

  const save = async () => {
    if (!strokes.length) { setMsg('Draw something first'); return; }
    setSaving(true); setMsg('');
    try {
      const uri = await captureRef(canvasRef, { format: 'png', quality: 1, result: 'base64' });
      const cloud = await uploadBase64ToCloudinary(uri as string);
      await api.saveMedia([{
        public_id: cloud.public_id,
        secure_url: cloud.secure_url,
        resource_type: 'image',
        format: cloud.format,
        width: cloud.width,
        height: cloud.height,
        caption: 'Scribble',
      }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/gallery');
    } catch (e: any) {
      setMsg(e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="scribble-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Scribble</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Pressable onPress={undo} testID="scribble-undo" style={styles.iconBtn}><Feather name="rotate-ccw" size={18} color={colors.onSurface} /></Pressable>
          <Pressable onPress={clear} testID="scribble-clear" style={styles.iconBtn}><Feather name="trash" size={18} color={colors.onSurface} /></Pressable>
          <ProfileButton />
        </View>
      </View>

      <View ref={canvasRef} collapsable={false} style={styles.canvas} {...responder.panHandlers} testID="scribble-canvas">
        <Svg width="100%" height="100%">
          {strokes.map((s, i) => (
            <Path key={i} d={s.d} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {!!current && (
            <Path d={current} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.colorsRow}>
          {COLORS.map(c => (
            <Pressable
              key={c} testID={`scribble-color-${c}`}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
            />
          ))}
        </View>
        <View style={styles.sizeRow}>
          {[2, 4, 8, 14].map(w => (
            <Pressable key={w} testID={`scribble-size-${w}`} onPress={() => setWidth(w)} style={[styles.sizeDot, width === w && styles.sizeActive]}>
              <View style={{ width: w, height: w, borderRadius: w / 2, backgroundColor: colors.onSurface }} />
            </Pressable>
          ))}
        </View>
        {!!msg && <Text style={styles.msg}>{msg}</Text>}
        <Pressable testID="scribble-save" style={[styles.save, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.saveText}>Save to Gallery</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.onSurface },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  canvas: { flex: 1, backgroundColor: colors.surfaceSecondary, margin: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  toolbar: { padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  colorsRow: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.onSurface },
  sizeRow: { flexDirection: 'row', gap: spacing.sm },
  sizeDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  sizeActive: { borderColor: colors.onSurface, backgroundColor: colors.brandTertiary },
  msg: { color: colors.error, fontFamily: fonts.bodyMedium },
  save: { backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: colors.onSurfaceInverse, fontFamily: fonts.bodySemi, fontSize: 15 },
});
