import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Body, Button, Chip, Field, H2, Muted, Screen } from '@/components/ui';
import { parseAmount } from '@/lib/cashbook';
import type { Extra } from '@/lib/extras-calc';
import { deleteExtra, saveExtra, useExtras } from '@/lib/extras';
import { useI18n } from '@/lib/i18n';
import { hasCashEntries } from '@/lib/programme';
import { formatDay, normalizeTime, tripDays, weekdayShort } from '@/lib/time';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { space, usePalette } from '@/theme';

/** Guide: add a paid extra (bar crawl, Ribs & Rodel...) with its price, or edit one (`?id=`). */
export default function ExtraEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const { trip, role } = useMembership();
  const { extras, loading } = useExtras(trip.id);
  const existing = id ? (extras.find((x) => x.id === id) ?? null) : null;
  if (role !== 'guide')
    return (
      <Screen>
        <Muted>{t('onlyGuideFinance')}</Muted>
      </Screen>
    );
  if (id && loading) return null;
  if (id && !existing)
    return (
      <Screen>
        <Body>{t('extraNotFound')}</Body>
        <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  return <ExtraForm key={existing?.id ?? 'new'} existing={existing} />;
}

function ExtraForm({ existing }: { existing: Extra | null }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const days = tripDays(trip.starts_on, trip.ends_on);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [day, setDay] = useState(existing?.day ?? (days.includes(clock.date) ? clock.date : days[0]));
  const [time, setTime] = useState(existing?.starts_at?.slice(0, 5) ?? '');
  const [price, setPrice] = useState(existing ? Number(existing.price).toFixed(2).replace('.', ',') : '');
  const [itemId, setItemId] = useState<string | null>(existing?.programme_item_id ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Picking a programme item fills in its day, time and name.
  function link(id: string | null) {
    setItemId(id);
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setDay(it.day);
    setTime(it.starts_at.slice(0, 5));
    if (!title.trim()) setTitle(it.title);
  }

  async function save() {
    if (!title.trim()) return setError(t('needExtraTitle'));
    const sum = price.trim() === '0' ? 0 : parseAmount(price);
    if (sum == null) return setError(t('needPrice'));
    // A time is needed: the extra also appears in the programme.
    const startsAt = normalizeTime(time);
    if (!startsAt) return setError(t('timeFormat1800'));
    setBusy(true);
    setError(null);
    try {
      const id = await saveExtra(
        trip.id,
        {
          title,
          day,
          starts_at: startsAt,
          price: sum,
          programme_item_id: itemId,
          notes,
        },
        existing?.id,
      );
      if (existing) router.back();
      else router.replace({ pathname: '/extra/[id]', params: { id } });
    } catch {
      setError(t('saveFailed'));
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteExtra(existing.id);
      router.dismissTo('/extras');
    } catch (e) {
      setError(t(hasCashEntries(e) ? 'deleteExtraHasEntries' : 'deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H2>{existing ? t('editExtra') : t('newExtra')}</H2>
      <Field label={t('title')} value={title} onChangeText={setTitle} placeholder={t('extraTitlePlaceholder')} maxLength={80} />
      <Field label={t('pricePerPerson')} value={price} onChangeText={setPrice} placeholder="25,00" keyboardType="decimal-pad" maxLength={10} />

      <View style={{ gap: space.s }}>
        <Body style={{ fontWeight: '700' }}>{t('day')}</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
          {days.map((d) => (
            <Chip key={d} sub={weekdayShort(d, locale)} label={String(Number(d.slice(8)))} selected={d === day} onPress={() => setDay(d)} />
          ))}
        </ScrollView>
      </View>
      <Field label={t('time')} value={time} onChangeText={setTime} placeholder="21:00" keyboardType="numbers-and-punctuation" maxLength={5} />

      {items.length ? (
        <View style={{ gap: space.s }}>
          <Body style={{ fontWeight: '700' }}>{t('linkProgramme')}</Body>
          <Muted>{t('extraInProgramme')}</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <Chip small label={t('noLink')} selected={!itemId} onPress={() => link(null)} />
            {items.map((i) => (
              <Chip key={i.id} small label={`${i.title} · ${formatDay(i.day, locale)}`} selected={itemId === i.id} onPress={() => link(i.id)} />
            ))}
          </View>
        </View>
      ) : null}

      <Field label={t('details')} value={notes} onChangeText={setNotes} multiline maxLength={400} />

      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label={t('save')} onPress={save} busy={busy} />
      {existing ? (
        confirmDelete ? (
          <View style={{ gap: space.s }}>
            <Body>{t('deleteExtraConfirm', { title: existing.title })}</Body>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button label={t('delete')} variant="danger" onPress={remove} busy={busy} />
              <Button label={t('no')} variant="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <Button label={t('deleteExtra')} variant="danger" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
