import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, fonts } from '@/src/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  onScribble: () => void;
  onAI: () => void;
};

export default function CreateSheet({ open, onClose, onUpload, onScribble, onAI }: Props) {
  const options = [
    { key: 'upload', icon: 'upload', label: 'Upload Photo / Video', desc: 'Add memories to the gallery', onPress: onUpload, testID: 'create-upload' },
    { key: 'scribble', icon: 'edit-3', label: 'Scribble', desc: 'Draw a note by hand', onPress: onScribble, testID: 'create-scribble' },
    { key: 'ai', icon: 'zap', label: 'AI Studio', desc: 'Craft new art from photos', onPress: onAI, testID: 'create-ai' },
  ] as const;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="create-sheet-backdrop" />
      <View style={styles.sheet} testID="create-sheet">
        <View style={styles.handle} />
        <Text style={styles.title}>Create</Text>
        {options.map((opt) => (
          <Pressable key={opt.key} onPress={opt.onPress} style={styles.row} testID={opt.testID}>
            <View style={styles.iconBubble}>
              <Feather name={opt.icon as any} size={20} color={colors.onSurface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{opt.label}</Text>
              <Text style={styles.desc}>{opt.desc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.cancel} testID="create-sheet-cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing['2xl'],
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.onSurface, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  iconBubble: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.onSurface },
  desc: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  cancel: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.onSurfaceSecondary },
});
