import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getUser } from '@/src/api';
import { colors, fonts } from '@/src/theme';

export default function ProfileButton() {
  const router = useRouter();
  const [initials, setInitials] = useState('..');

  useEffect(() => {
    (async () => {
      const u = await getUser();
      if (u) setInitials((u.name || u.username || '').slice(0, 2).toUpperCase());
    })();
  }, []);

  return (
    <Pressable testID="header-profile" onPress={() => router.push('/profile')} style={styles.btn}>
      <View style={styles.avatar}>
        <Text style={styles.text}>{initials}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { color: colors.onBrandPrimary, fontFamily: fonts.bodySemi, fontSize: 14 },
});
