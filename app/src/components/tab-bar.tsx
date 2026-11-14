import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View, type PressableStateCallbackType } from 'react-native';

import { Icon, Mountain, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { signOut } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useWide } from '@/lib/layout';
import { useTrip } from '@/lib/trip';
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
export function TabBar(props: BottomTabBarProps) {
  const wide = useWide();
  return wide ? <SideBar {...props} /> : <BottomBar {...props} />;
}

function BottomBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
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

/** On the web Pressable also reports mouse hover. */
const isHovered = (state: PressableStateCallbackType) => !!(state as { hovered?: boolean }).hovered;

/**
 * The same tabs as a sidebar for a wide window: brand mark on top, one row per tab (icon and label),
 * sign-out at the bottom. Yellow for travellers and dark for guides, like the top bar on a phone.
 */
function SideBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const c = usePalette();
  const { t } = useI18n();
  const { membership } = useTrip();
  const guide = membership?.role === 'guide';
  const bg = guide ? c.brandInk : c.brand;
  const fg = guide ? c.brand : c.brandInk;
  const dim = guide ? 'rgba(255,231,106,0.72)' : 'rgba(26,26,20,0.72)';
  return (
    <View style={[styles.side, { backgroundColor: bg }]}>
      <View style={styles.sideMark} accessibilityRole="header">
        <Mountain color={fg} />
        <Text face="display" style={[styles.sideName, { color: fg }]}>
          {guide ? t('guideDesk') : t('appName')}
        </Text>
      </View>
      {membership ? (
        <Text numberOfLines={2} style={[styles.sideTrip, { color: dim }]}>
          {membership.trip.name}
        </Text>
      ) : null}
      <View style={styles.sideNav} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const options = descriptors[route.key]?.options;
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
              style={(state) => [
                styles.sideItem,
                { backgroundColor: focused ? fg : isHovered(state) || state.pressed ? (guide ? 'rgba(255,231,106,0.12)' : 'rgba(26,26,20,0.08)') : 'transparent' },
              ]}>
              <Icon name={ICON[route.name] ?? 'home'} size={21} color={focused ? bg : fg} />
              <Text numberOfLines={1} style={[styles.sideLabel, { color: focused ? bg : fg }]}>
                {title}
              </Text>
              {badge != null ? (
                <View style={[styles.sideBadge, { backgroundColor: c.live }]} accessibilityLabel={t('unread', { n: String(badge) })}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('signOut')}
        onPress={signOut}
        style={(state) => [styles.sideItem, { opacity: isHovered(state) ? 1 : 0.8 }]}>
        <Icon name="logout" size={19} color={fg} />
        <Text style={[styles.sideLabel, { color: fg, fontWeight: '600' }]}>{t('signOut')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { width: 248, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 18, gap: 6 },
  sideMark: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  sideName: { fontSize: 18, fontWeight: '800' },
  sideTrip: { fontSize: 13, fontWeight: '600', paddingHorizontal: 10, marginTop: 2, marginBottom: 14, lineHeight: 18 },
  sideNav: { flex: 1, gap: 4 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  sideLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  sideBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
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
