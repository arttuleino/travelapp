import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/theme';

/** Brand tab bar: label with a yellow pill behind the selected tab. */
export function TabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const c = usePalette();
  return (
    <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const title = descriptors[route.key]?.options.title ?? route.name;
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
});
