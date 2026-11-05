import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGUAGES, useI18n } from '@/lib/i18n';
import { radius, space, usePalette } from '@/theme';

/** Language list for the Profile tab: one row per language, the current one ticked. */
export function LanguageList() {
  const c = usePalette();
  const { lang, setLang } = useI18n();
  return (
    <View style={{ gap: space.s }} accessibilityRole="radiogroup">
      {LANGUAGES.map((l) => {
        const selected = l.code === lang;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => setLang(l.code)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: selected ? c.brand : c.card, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={[styles.name, { color: selected ? c.brandInk : c.fg }]}>{l.name}</Text>
            {selected ? <Text style={[styles.tick, { color: c.brandInk }]}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact language switch for the login screen (before Profile is reachable). */
export function LanguageChips() {
  const c = usePalette();
  const { lang, setLang } = useI18n();
  return (
    <View style={styles.chips}>
      {LANGUAGES.map((l) => {
        const selected = l.code === lang;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="button"
            accessibilityLabel={l.name}
            accessibilityState={{ selected }}
            onPress={() => setLang(l.code)}
            hitSlop={4}
            style={[styles.chip, { borderColor: selected ? c.fg : c.line, backgroundColor: selected ? c.brand : 'transparent' }]}>
            <Text style={{ color: selected ? c.brandInk : c.muted, fontSize: 12, fontWeight: '700' }}>{shortName(l.code)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const shortName = (code: string) => (code === 'de-AT' ? 'AT' : code.toUpperCase());

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.card },
  name: { fontSize: 15, fontWeight: '700' },
  tick: { fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
});
