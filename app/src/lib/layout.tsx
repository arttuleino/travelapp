import { Children, createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '@/theme';

/** From this window width up (laptops, desktops, landscape tablets) the app uses the desktop layout. */
export const WIDE_MIN = 1024;

/** True on a wide window: side navigation instead of bottom tabs, and wider content. */
export function useWide() {
  return useWindowDimensions().width >= WIDE_MIN;
}

/** True inside the tab screens while the side navigation is showing (it carries the brand and sign-out). */
export const SidebarContext = createContext(false);
export const useInSidebar = () => useContext(SidebarContext);

/** Content width: forms stay narrow, tab pages and lists get more room on a wide window. */
export const CONTENT = { narrow: 560, page: 1040, full: 1280 };

/**
 * Side-by-side columns on a wide window, stacked (in the given order) on a phone.
 * `weights` sets the relative column widths, e.g. [3, 2].
 */
export function Columns({ children, weights, style }: { children: ReactNode; weights?: number[]; style?: StyleProp<ViewStyle> }) {
  const wide = useWide();
  const items = Children.toArray(children).filter(Boolean);
  if (!wide) return <View style={[{ gap: 18 }, style]}>{items}</View>;
  return (
    <View style={[styles.row, style]}>
      {items.map((child, i) => (
        <View key={i} style={{ flex: weights?.[i] ?? 1, minWidth: 0, gap: 18 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Cards in equal columns on a wide window (`cols` per row), one per row on a phone. */
export function Grid({ children, cols = 2, gap = space.s }: { children: ReactNode; cols?: number; gap?: number }) {
  const wide = useWide();
  const items = Children.toArray(children).filter(Boolean);
  if (!wide || cols < 2) return <View style={{ gap }}>{items}</View>;
  return (
    <View style={[styles.wrap, { marginHorizontal: -gap / 2, marginBottom: -gap }]}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, paddingHorizontal: gap / 2, paddingBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});
