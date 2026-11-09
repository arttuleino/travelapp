import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Mountain } from '@/components/icon';
import { Text } from '@/components/text';
import { signOut, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useTrip } from '@/lib/trip';
import { usePalette } from '@/theme';

/** App bar from the design: yellow with the mountain mark for travellers, dark "guide desk" for guides. */
export function TopBar() {
  const c = usePalette();
  const { t } = useI18n();
  const signedIn = !!useAuth().session;
  const guide = useTrip().membership?.role === 'guide';
  const bg = guide ? c.brandInk : c.brand;
  const fg = guide ? c.brand : c.brandInk;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: bg }}>
      <View style={styles.row}>
        <View style={styles.mark} accessibilityRole="header">
          <Mountain color={fg} />
          <Text face="display" style={[styles.name, { color: fg }]}>
            {guide ? t('guideDesk') : t('appName')}
          </Text>
        </View>
        {signedIn ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('signOut')} onPress={signOut} hitSlop={8} style={styles.iconbtn}>
            {({ pressed }) => (
              <View style={{ opacity: pressed ? 0.6 : 1 }}>
                <Icon name="logout" size={20} color={fg} />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '800' },
  iconbtn: { padding: 6, borderRadius: 99 },
});
