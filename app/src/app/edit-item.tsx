import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Button, Chip, Field, H2, Muted, Screen } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { changeNotice, deleteItem, hasCashEntries, postAnnouncement, saveItem, type ItemInput } from '@/lib/programme';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { hhmm, normalizeTime, tripDays, weekdayShort } from '@/lib/time';
import type { ProgrammeItem } from '@/lib/types';
import { space, usePalette } from '@/theme';

export default function EditItem() {
  const { id, day: dayParam } = useLocalSearchParams<{ id?: string; day?: string }>();
  const { t } = useI18n();
  const { trip, role } = useMembership();
  const { items, loading } = useProgramme(trip.id);
  const existing = id ? (items.find((i) => i.id === id) ?? null) : null;

  if (role !== 'guide') return <Message text={t('onlyGuideEdits')} />;
  if (id && loading) return null;
  if (id && !existing) return <Message text={t('itemNotFound')} />;
  return <EditForm key={existing?.id ?? 'new'} existing={existing} initialDay={dayParam} />;
}

function Message({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <Screen>
      <Body>{text}</Body>
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function EditForm({ existing, initialDay }: { existing: ProgrammeItem | null; initialDay?: string }) {
  const c = usePalette();
  const { t, lang, locale } = useI18n();
  const { trip, display_name } = useMembership();
  const clock = useTripClock(trip.timezone);
  const days = tripDays(trip.starts_on, trip.ends_on);
  // Notify the group by default when the change affects today or tomorrow.
  const soon = (d: string) => d === clock.date || d === days[days.indexOf(clock.date) + 1];

  const [day, setDay] = useState(existing?.day ?? initialDay ?? days[0]);
  const [time, setTime] = useState(existing ? hhmm(existing.starts_at) : '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [details, setDetails] = useState(existing?.details ?? '');
  const [notify, setNotify] = useState(() => soon(existing?.day ?? initialDay ?? days[0]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function pickDay(d: string) {
    setDay(d);
    setNotify(soon(d));
  }

  const normTime = normalizeTime(time);

  async function save() {
    if (!normTime) return setError(t('timeFormat0915'));
    if (!title.trim()) return setError(t('needTitle'));
    setBusy(true);
    setError(null);
    const input: ItemInput = { trip_id: trip.id, day, starts_at: normTime, title: title.trim(), details: details.trim() };
    try {
      await saveItem(input, existing?.id);
      if (notify) {
        const n = changeNotice(existing, input, lang);
        await postAnnouncement(trip.id, n.title, n.body, display_name);
      }
      router.back();
    } catch {
      setError(t('saveFailed'));
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteItem(existing.id);
      if (notify) {
        const n = changeNotice(existing, null, lang);
        await postAnnouncement(trip.id, n.title, n.body, display_name);
      }
      router.back();
    } catch (e) {
      setError(t(hasCashEntries(e) ? 'deleteItemHasEntries' : 'deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H2>{existing ? t('editItem') : t('newItem')}</H2>
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.fg, fontWeight: '600', fontSize: 14 }}>{t('day')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
          {days.map((d) => {
            return <Chip key={d} sub={weekdayShort(d, locale)} label={String(Number(d.slice(8)))} selected={d === day} onPress={() => pickDay(d)} />;
          })}
        </ScrollView>
      </View>
      <Field label={t('time')} value={time} onChangeText={setTime} placeholder="09:15" keyboardType="numbers-and-punctuation" maxLength={5} />
      <Field label={t('title')} value={title} onChangeText={setTitle} placeholder={t('itemTitlePlaceholder')} maxLength={200} />
      <Field label={t('details')} value={details} onChangeText={setDetails} placeholder={t('detailsPlaceholder')} multiline />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>{t('notifyGroup')}</Body>
          <Muted>{t('notifyHint')}</Muted>
        </View>
        <Switch value={notify} onValueChange={setNotify} trackColor={{ true: c.ok, false: c.pillOff }} accessibilityLabel={t('notifyA11y')} />
      </View>
      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label={t('save')} onPress={save} busy={busy} />
      {existing ? (
        confirmDelete ? (
          <View style={{ gap: space.s }}>
            <Body>{t('deleteConfirm', { title: existing.title })}</Body>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button label={t('delete')} variant="danger" onPress={remove} busy={busy} />
              <Button label={t('cancel')} variant="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <Button label={t('deleteItem')} variant="ghost" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
      <Button label={t('cancel')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
