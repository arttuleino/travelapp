import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Body, Button, Chip, Field, H2, Muted, Screen } from '@/components/ui';
import { useAnnouncements, useMembers } from '@/lib/chat';
import { useI18n } from '@/lib/i18n';
import { cancelAnnouncement, postAnnouncement, updateAnnouncement } from '@/lib/programme';
import { addDays, normalizeTime, tripClock, zonedTimeToUtc } from '@/lib/time';
import { useMembership } from '@/lib/trip';
import type { Announcement } from '@/lib/types';
import { clockTime, dayLabel } from '@/lib/unread';
import { space, usePalette } from '@/theme';

const TEMPLATES = ['template1', 'template2', 'template3'] as const;

/**
 * Guide: send a notice to the whole group now or at a set time, or edit one (`?id=`).
 * It appears on everyone's home screen and chat, and as a push notification.
 */
export default function Announce() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const { trip, role } = useMembership();
  const announcements = useAnnouncements(trip.id);
  const existing = id ? (announcements.find((a) => a.id === id) ?? null) : null;

  if (role !== 'guide') return <Message text={t('onlyGuideAnnounces')} />;
  if (id && !existing) return announcements.length ? <Message text={t('announcementNotFound')} /> : null;
  return <AnnounceForm key={existing?.id ?? 'new'} existing={existing} />;
}

function Message({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <Screen>
      <Muted>{text}</Muted>
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

/** Scheduling uses the real clock (not the demo clock), since the server decides when it goes out. */
function realNow(timeZone: string) {
  return tripClock(timeZone, new Date());
}

/** Default for a new scheduled notice: the next full hour, at least 30 minutes away. */
function defaultSlot(timeZone: string) {
  const later = tripClock(timeZone, new Date(Date.now() + 90 * 60_000));
  return { day: later.date, time: `${later.time.slice(0, 2)}:00` };
}

function AnnounceForm({ existing }: { existing: Announcement | null }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const words = { today: t('today'), yesterday: t('yesterday'), tomorrow: t('tomorrow') };
  const { trip, display_name } = useMembership();
  const tz = trip.timezone;
  const pax = useMembers(trip.id)
    .filter((m) => m.role === 'traveller')
    .reduce((s, m) => s + m.party_size, 0);

  const [openedAt] = useState(() => new Date().toISOString());
  const sent = !!existing && existing.send_at <= openedAt;
  const scheduledExisting = !!existing && !sent;

  // The guide types the time in the phone's own time zone by default, or in the destination's.
  const phoneTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sameZone = phoneTz === tz;
  const [zone, setZone] = useState<'phone' | 'trip'>('phone');
  const inputTz = zone === 'phone' ? phoneTz : tz;
  const today = realNow(inputTz).date;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [title, setTitle] = useState(existing?.title ?? t('defaultAnnouncementTitle'));
  const [body, setBody] = useState(existing?.body ?? '');
  const [later, setLater] = useState(scheduledExisting);
  const [day, setDay] = useState(() =>
    scheduledExisting ? localDate(existing.send_at, phoneTz) : defaultSlot(phoneTz).day,
  );
  const [time, setTime] = useState(() => (scheduledExisting ? clockTime(existing.send_at, phoneTz) : defaultSlot(phoneTz).time));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const normTime = normalizeTime(time);
  const sendAt = later && normTime ? zonedTimeToUtc(day, normTime, inputTz) : null;

  /** Switching zone keeps the same moment and rewrites the day and time in the other zone. */
  function pickZone(next: 'phone' | 'trip') {
    if (next === zone) return;
    const nextTz = next === 'phone' ? phoneTz : tz;
    if (sendAt) {
      setDay(localDate(sendAt, nextTz));
      setTime(clockTime(sendAt, nextTz));
    }
    setZone(next);
  }

  const zoneName = zone === 'phone' ? t('phoneTimeLower') : t('tripTimeLower');
  const nowHint = sameZone
    ? t('clockNow', { time: realNow(tz).time })
    : t('clockNowBoth', { phone: realNow(phoneTz).time, trip: realNow(tz).time, place: trip.destination });
  const when = sendAt
    ? t('at', { day: dayLabel(sendAt, today, inputTz, words, locale).toLowerCase(), time: clockTime(sendAt, inputTz) }) +
      (sameZone ? '' : ` ${zoneName}`) +
      (sameZone ? '' : zone === 'phone' ? ` ${t('atTripTime', { time: clockTime(sendAt, tz) })}` : ` ${t('atPhoneTime', { time: clockTime(sendAt, phoneTz) })}`)
    : '';

  async function save() {
    if (!body.trim()) return setError(t('writeAnnouncementText'));
    if (later && !normTime) return setError(t('timeFormat1800'));
    if (sendAt && !isInFuture(sendAt)) return setError(t('timeInPast'));
    setBusy(true);
    setError(null);
    const heading = title.trim() || t('defaultAnnouncementTitle');
    try {
      if (!existing) await postAnnouncement(trip.id, heading, body.trim(), display_name, sendAt ?? undefined);
      else if (sent) await updateAnnouncement(existing.id, heading, body.trim());
      else await updateAnnouncement(existing.id, heading, body.trim(), sendAt ?? new Date().toISOString());
      router.back();
    } catch {
      setError(t('saveFailed'));
      setBusy(false);
    }
  }

  async function cancel() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await cancelAnnouncement(existing.id);
      router.back();
    } catch {
      setError(t('cancelFailed'));
      setBusy(false);
    }
  }

  const label = sent || (existing && later) ? t('saveChanges') : later ? t('scheduleAnnouncement') : existing ? t('sendNow') : t('sendToGroup');

  return (
    <Screen>
      <H2>{existing ? t('editAnnouncement') : t('announcementToGroup')}</H2>
      {sent ? (
        <Muted>
          {t('sentInfo', { at: t('at', { day: dayLabel(existing.send_at, today, tz, words, locale).toLowerCase(), time: clockTime(existing.send_at, tz) }) })}
        </Muted>
      ) : (
        <Muted>{t('goesTo', { n: pax })}</Muted>
      )}

      {!existing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {TEMPLATES.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => setBody(t(key))}
              style={{ borderWidth: 1.5, borderColor: c.line, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 }}>
              <Text style={{ color: c.fg, fontSize: 13 }}>{t(key)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label={t('title')} value={title} onChangeText={setTitle} maxLength={80} />
      <Field
        label={t('message')}
        value={body}
        onChangeText={setBody}
        multiline
        placeholder={t('writeAnnouncement')}
        style={{ minHeight: 110, textAlignVertical: 'top' }}
      />

      {!sent ? (
        <View style={{ gap: space.s }}>
          <Body style={{ fontWeight: '700' }}>{t('whenSent')}</Body>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Chip label={t('immediately')} selected={!later} onPress={() => setLater(false)} />
            <Chip label={t('scheduleChip')} selected={later} onPress={() => setLater(true)} />
          </View>
          {later ? (
            <View style={{ gap: space.s }}>
              {!sameZone ? (
                <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
                  <Chip label={t('phoneTime')} selected={zone === 'phone'} onPress={() => pickZone('phone')} />
                  <Chip label={t('tripTime', { place: trip.destination })} selected={zone === 'trip'} onPress={() => pickZone('trip')} />
                </View>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
                {days.map((d, i) => (
                  <Chip
                    key={d}
                    label={i === 0 ? t('today') : i === 1 ? t('tomorrow') : dayLabel(`${d}T12:00:00Z`, today, 'UTC', words, locale)}
                    selected={d === day}
                    onPress={() => setDay(d)}
                  />
                ))}
              </ScrollView>
              <Field
                label={sameZone ? t('time') : t('timeIn', { zone: zoneName })}
                value={time}
                onChangeText={setTime}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Muted>
                {nowHint}
                {when ? ` ${t('travellersSee', { when })}` : ''}
              </Muted>
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label={label} onPress={save} busy={busy} />
      {scheduledExisting ? (
        confirmCancel ? (
          <View style={{ gap: space.s }}>
            <Body>{t('cancelAnnouncementConfirm')}</Body>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button label={t('cancelAnnouncement')} variant="danger" onPress={cancel} busy={busy} />
              <Button label={t('no')} variant="ghost" onPress={() => setConfirmCancel(false)} />
            </View>
          </View>
        ) : (
          <Button label={t('cancelScheduled')} variant="danger" onPress={() => setConfirmCancel(true)} />
        )
      ) : null}
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

/** Later than now, so the notice is not "scheduled" into the past (the next minute is fine). */
function isInFuture(iso: string) {
  return new Date(iso).getTime() > new Date().getTime();
}

/** The trip-local date of an instant. */
function localDate(iso: string, timeZone: string) {
  return tripClock(timeZone, new Date(iso)).date;
}
