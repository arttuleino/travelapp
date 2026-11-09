import type { ComponentProps } from 'react';
import { Text as RNText, StyleSheet } from 'react-native';

import { fontFamily, type Face } from '@/fonts';

/**
 * Drop-in for React Native's Text that uses the app typefaces. The weight in `style` picks the
 * matching font file (Android cannot fake weights of a custom font). `face` switches to the
 * heading or the clock-time font; a `fontFamily` set in `style` wins.
 */
export function Text({ face = 'body', style, ...props }: ComponentProps<typeof RNText> & { face?: Face }) {
  const flat = StyleSheet.flatten(style) ?? {};
  const family = flat.fontFamily ?? fontFamily(face, flat.fontWeight);
  return <RNText {...props} style={[style, { fontFamily: family, fontWeight: flat.fontFamily ? flat.fontWeight : undefined }]} />;
}
