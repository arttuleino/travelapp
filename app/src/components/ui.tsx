import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '@/components/top-bar';
import { fontFamily } from '@/fonts';
import { CONTENT, useInSidebar, useWide } from '@/lib/layout';
import { radius, space, usePalette } from '@/theme';

/**
 * A page. `width` is how wide the content may grow on a wide window: tab pages default to `page`,
 * other screens (mostly forms) stay `narrow`. On a phone every page uses the full screen width.
 */
export function Screen({
  children,
  scroll = true,
  bar = true,
  width,
}: {
  children: ReactNode;
  scroll?: boolean;
  bar?: boolean;
  width?: keyof typeof CONTENT;
}) {
  const c = usePalette();
  const wide = useWide();
  const inSidebar = useInSidebar();
  const maxWidth = CONTENT[width ?? (inSidebar ? 'page' : 'narrow')];
  const body = <View style={[styles.inner, { maxWidth }, wide && styles.innerWide]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {bar ? <TopBar /> : <SafeAreaView edges={['top']} />}
      {/* Keeps the field being typed in above the keyboard; swipe down to close the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: space.xl * 2 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets>
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function H1({ children, style }: TextProps) {
  const c = usePalette();
  return (
    <Text face="display" style={[styles.h1, { color: c.fg }, style]}>
      {children}
    </Text>
  );
}
export function H2({ children, style }: TextProps) {
  const c = usePalette();
  return (
    <Text face="display" style={[styles.h2, { color: c.fg }, style]}>
      {children}
    </Text>
  );
}
export function Body({ children, style, numberOfLines }: TextProps) {
  const c = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[styles.body, { color: c.fg }, style]}>
      {children}
    </Text>
  );
}
export function Muted({ children, style, numberOfLines }: TextProps) {
  const c = usePalette();
  return (
    <Text numberOfLines={numberOfLines} style={[styles.small, { color: c.muted }, style]}>
      {children}
    </Text>
  );
}
export function Eyebrow({ children, style }: TextProps) {
  const c = usePalette();
  return <Text style={[styles.eyebrow, { color: c.muted }, style]}>{children}</Text>;
}

export function Card({ children, style, tone = 'card' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'card' | 'cream' | 'brand' }) {
  const c = usePalette();
  const bg = tone === 'brand' ? c.brand : tone === 'cream' ? c.cream : c.card;
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = usePalette();
  const off = disabled || busy;
  const bg = off ? c.pillOff : variant === 'primary' ? c.brand : 'transparent';
  const fg = off ? c.muted : variant === 'primary' ? c.brandInk : variant === 'danger' ? c.live : c.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: pressed ? 0.75 : 1 },
        variant !== 'primary' && { borderWidth: 1.5, borderColor: variant === 'danger' ? c.live : c.line },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text face="display" style={[styles.btnText, small && { fontSize: 13 }, { color: fg }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const c = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[styles.input, { borderColor: error ? c.live : c.line, color: c.fg, backgroundColor: c.bg }, props.style]}
      />
      {error ? <Text style={[styles.small, { color: c.live }]}>{error}</Text> : null}
    </View>
  );
}

/** `small` is for word choices (filters, account pickers) rather than big day numbers. */
export function Chip({ label, sub, selected, onPress, small }: { label: string; sub?: string; selected: boolean; onPress: () => void; small?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? c.brand : c.card }]}>
      {sub ? <Text style={[styles.chipSub, { color: selected ? c.brandInk : c.muted }]}>{sub}</Text> : null}
      <Text face="display" style={[styles.chipLabel, small && styles.chipLabelSmall, { color: selected ? c.brandInk : c.fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  const c = usePalette();
  return <View style={[styles.centered, { backgroundColor: c.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: space.l, paddingTop: 18, gap: 18, width: '100%', alignSelf: 'center' },
  innerWide: { paddingHorizontal: 32, paddingTop: 32, gap: 22 },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3, lineHeight: 33 },
  h2: { fontSize: 21, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.96, textTransform: 'uppercase' },
  card: { borderRadius: radius.card, padding: space.l, gap: space.s },
  btn: { borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 13, minHeight: 34 },
  btnText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: fontFamily('body', '400') },
  chip: { borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, minWidth: 58, alignItems: 'center' },
  chipSub: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  chipLabel: { fontSize: 18, fontWeight: '800' },
  chipLabelSmall: { fontSize: 14, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.m },
});
