import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getToken, getUser } from '@/src/api';
import { colors } from '@/src/theme';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const user = await getUser();
      if (!token || !user) { router.replace('/login'); return; }
      if (user.must_change_password) { router.replace('/change-password'); return; }
      if (user.role === 'superadmin') router.replace('/(admin)/spaces');
      else router.replace('/(tabs)/gallery');
    })();
  }, []);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
