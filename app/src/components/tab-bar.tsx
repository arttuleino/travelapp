import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { useI18n } from '@/lib/i18n';
import { usePalette } from '@/theme';

/** Icon for each tab route; guides see their Profile as the group tab (guests, extras). */
const ICON: Record<string, IconName> = {
  index: 'home',
  programme: 'cal',
  map: 'map',
  chat: 'chat',
  inbox: 'chat',
  finance: 'euro',
  trip: 'info',
  profile: 'users',
};

/** Brand tab bar from the design: an icon in a pill (yellow when selected) with the label below. */
export function TabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const c = usePalette();
  const { t } = useI18n();
  return (
    <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: insets.bottom }]}>
      <View style={styles.nav}>
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
              accessibilityLabel={title}
              accessibilityState={{ selected: focused }}
              onPress={() => navigateToTab(route.key)}
              style={styles.tab}>
              <View style={[styles.pill, { backgroundColor: focused ? c.brand : 'transparent' }]}>
                <Icon name={ICON[route.name] ?? 'home'} size={23} color={focused ? c.brandInk : c.muted} />
              </View>
              <Text numberOfLines={1} style={[styles.label, { color: focused ? c.fg : c.muted }]}>
                {title}
              </Text>
              {badge != null ? (
                <View style={[styles.badge, { backgroundColor: c.live }]} accessibilityLabel={t('unread', { n: String(badge) })}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  nav: { flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 9, paddingBottom: 10 },
  pill: { width: 52, height: 30, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11.5, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: 6,
    left: '50%',
    marginLeft: 10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
});
