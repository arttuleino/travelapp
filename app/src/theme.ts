import { useColorScheme } from 'react-native';

// Brand: operator yellow + cream, black text. Operators get their own accent later (operators.brand_color).
const light = {
  brand: '#FFE76A',
  brandInk: '#1A1A14',
  bg: '#FFFFFF',
  fg: '#16160F',
  muted: '#5E5B48',
  line: '#E8E2C2',
  card: '#FFFBE6',
  cream: '#FFF7CF',
  ok: '#1F7A3E',
  warn: '#A35A00',
  warnBg: '#FBF0E1',
  live: '#D6332B',
  pillOff: '#ECE7CF',
};
const dark: typeof light = {
  ...light,
  bg: '#121210',
  fg: '#F4F1E2',
  muted: '#B3AE95',
  line: '#2E2C22',
  card: '#1C1B16',
  cream: '#24221A',
  ok: '#5BC77F',
  warn: '#F0A54A',
  warnBg: '#2B2416',
  live: '#FF6A60',
  pillOff: '#2E2C22',
};
export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24 };
export const radius = { card: 18, pill: 999 };
