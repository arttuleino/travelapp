import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { currentIndex, hhmm } from '@/lib/time';
import type { ProgrammeItem } from '@/lib/types';
import { space, usePalette } from '@/theme';

type Props = {
  items: ProgrammeItem[];
  /** Destination time 'HH:MM' when this list is today's programme; marks past and current items. */
  nowTime?: string | null;
  /** True for days that are already over (everything shown as past). */
  past?: boolean;
  onEdit?: (item: ProgrammeItem) => void;
};

export function Timeline({ items, nowTime, past, onEdit }: Props) {
  const c = usePalette();
  const { t } = useI18n();
  const now = nowTime ? currentIndex(items, nowTime) : -1;

  if (!items.length) {
    return <Text style={{ color: c.muted, fontSize: 14 }}>{t('noProgramme')}</Text>;
  }

  return (
    <View>
      {/* Programme times are always the destination's wall-clock time. */}
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>{t('localTimeNote')}</Text>
      {items.map((it, i) => {
        const isPast = past || (nowTime != null && i < now);
        const isNow = nowTime != null && i === now;
        const isNext = nowTime != null && i === now + 1;
        const first = i === 0;
        const last = i === items.length - 1;
        return (
          <View key={it.id} style={styles.row} accessibilityLabel={`${hhmm(it.starts_at)} ${it.title}${isNow ? `, ${t('inProgress')}` : ''}`}>
            <Text style={[styles.time, { color: isNow ? c.fg : c.muted, fontWeight: isNow ? '800' : '500' }]}>{hhmm(it.starts_at)}</Text>
            <View style={styles.rail}>
              <View style={[styles.line, { backgroundColor: c.line, top: first ? 8 : 0, bottom: last ? undefined : 0, height: last ? 8 : undefined }]} />
              <View
                style={[
                  styles.dot,
                  { borderColor: isNow ? c.fg : c.muted, backgroundColor: isPast ? c.muted : isNow ? c.brand : c.bg },
                  isNow && styles.dotNow,
                ]}
              />
            </View>
            <View style={styles.body}>
              <Text style={[styles.title, { color: isPast ? c.muted : c.fg }]}>{it.title}</Text>
              {it.details ? <Text style={[styles.details, { color: c.muted }]}>{it.details}</Text> : null}
              <View style={styles.tags}>
                {it.previous_starts_at ? (
                  <Text style={[styles.tag, { backgroundColor: c.warnBg, color: c.warn }]}>
                    {t('moved', { from: hhmm(it.previous_starts_at), to: hhmm(it.starts_at) })}
                  </Text>
                ) : null}
                {isNext ? <Text style={[styles.tag, { backgroundColor: c.cream, color: c.fg }]}>{t('next')}</Text> : null}
              </View>
            </View>
            {onEdit ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('editA11y', { title: it.title })} onPress={() => onEdit(it)} style={styles.edit} hitSlop={8}>
                <Text style={{ color: c.muted, fontWeight: '700', fontSize: 13 }}>{t('edit')}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 58 },
  time: { width: 50, fontSize: 13, paddingTop: 1, fontVariant: ['tabular-nums'] },
  rail: { width: 22, alignItems: 'center', marginRight: space.s },
  line: { position: 'absolute', width: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 4 },
  dotNow: { width: 16, height: 16, borderRadius: 8, marginTop: 2 },
  body: { flex: 1, paddingBottom: 14, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  details: { fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { fontSize: 11.5, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' },
  edit: { paddingLeft: space.s, paddingTop: 1 },
});
