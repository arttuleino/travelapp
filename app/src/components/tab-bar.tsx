import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { usePalette } from '@/theme';

/** Brand tab bar: label with a yellow pill behind the selected tab. */
export function TabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const c = usePalette();
  const { t } = useI18n();
  return (
    <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const options = descriptors[route.key]?.options;
        // Tabs declared with `href: null` (e.g. the guide inbox for travellers) are hidden.
        if ((options as { hidden?: boolean } | undefined)?.hidden) return null;
        const focused = state.index === i;
        const title = options?.title ?? route.name;
        const badge = options?.tabBarBadge;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => navigateToTab(route.key)}
            style={styles.tab}>
            <View style={[styles.pill, { backgroundColor: focused ? c.brand : 'transparent' }]}>
              <Text style={[styles.label, { color: focused ? c.brandInk : c.muted }]}>{title}</Text>
            </View>
            {badge != null ? (
              <View style={[styles.badge, { backgroundColor: c.live }]} accessibilityLabel={t('unread', { n: String(badge) })}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 },
  label: { fontSize: 13, fontWeight: '700' },
  badge: { position: 'absolute', top: -4, left: '58%', minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
