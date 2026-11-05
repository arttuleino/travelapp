import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Body, Button, Chip, Field, H2, Muted, Screen } from '@/components/ui';
import { useAnnouncements, useMembers } from '@/lib/chat';
import { cancelAnnouncement, postAnnouncement, updateAnnouncement } from '@/lib/programme';
import { addDays, normalizeTime, tripClock, zonedTimeToUtc } from '@/lib/time';
import { useMembership } from '@/lib/trip';
import type { Announcement } from '@/lib/types';
import { clockTime, dayLabel } from '@/lib/unread';
import { space, usePalette } from '@/theme';

const TEMPLATES = [
  'Muistutus: illan nouto hotellin edestä klo 20:15.',
  'Tuuli on yltynyt, huippuhissi on suljettu toistaiseksi.',
  'Lounaspaikka vaihtuu, tavataan klo 12:30.',
];

/**
 * Guide: send a notice to the whole group now or at a set time, or edit one (`?id=`).
 * It appears on everyone's home screen and chat, and as a push notification.
 */
export default function Announce() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { trip, role } = useMembership();
  const announcements = useAnnouncements(trip.id);
  const existing = id ? (announcements.find((a) => a.id === id) ?? null) : null;

  if (role !== 'guide') return <Message text="Vain opas voi lähettää tiedotteita." />;
  if (id && !existing) return announcements.length ? <Message text="Tiedotetta ei löytynyt. Se on ehkä peruttu." /> : null;
  return <AnnounceForm key={existing?.id ?? 'new'} existing={existing} />;
}

function Message({ text }: { text: string }) {
  return (
    <Screen>
      <Muted>{text}</Muted>
      <Button label="Takaisin" variant="ghost" onPress={() => router.back()} />
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
  const { trip, display_name } = useMembership();
  const tz = trip.timezone;
  const pax = useMembers(trip.id)
    .filter((m) => m.role === 'traveller')
    .reduce((s, m) => s + m.party_size, 0);

  const [openedAt] = useState(() => new Date().toISOString());
  const sent = !!existing && existing.send_at <= openedAt;
  const scheduledExisting = !!existing && !sent;
  const today = realNow(tz).date;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const [title, setTitle] = useState(existing?.title ?? 'Tiedote');
  const [body, setBody] = useState(existing?.body ?? '');
  const [later, setLater] = useState(scheduledExisting);
  const [day, setDay] = useState(() =>
    scheduledExisting ? localDate(existing.send_at, tz) : defaultSlot(tz).day,
  );
  const [time, setTime] = useState(() => (scheduledExisting ? clockTime(existing.send_at, tz) : defaultSlot(tz).time));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const normTime = normalizeTime(time);
  const sendAt = later && normTime ? zonedTimeToUtc(day, normTime, tz) : null;
  const when = sendAt ? `${dayLabel(sendAt, today, tz).toLowerCase()} klo ${clockTime(sendAt, tz)}` : '';

  async function save() {
    if (!body.trim()) return setError('Kirjoita tiedotteen teksti.');
    if (later && !normTime) return setError('Anna kellonaika muodossa 18:00.');
    if (sendAt && !isInFuture(sendAt)) return setError('Valitse aika, joka on tulevaisuudessa.');
    setBusy(true);
    setError(null);
    const t = title.trim() || 'Tiedote';
    try {
      if (!existing) await postAnnouncement(trip.id, t, body.trim(), display_name, sendAt ?? undefined);
      else if (sent) await updateAnnouncement(existing.id, t, body.trim());
      else await updateAnnouncement(existing.id, t, body.trim(), sendAt ?? new Date().toISOString());
      router.back();
    } catch {
      setError('Tallennus ei onnistunut. Tarkista verkkoyhteys ja yritä uudelleen.');
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
      setError('Peruminen ei onnistunut. Tiedote on ehkä jo lähtenyt.');
      setBusy(false);
    }
  }

  const label = sent || (existing && later) ? 'Tallenna muutokset' : later ? 'Ajasta tiedote' : existing ? 'Lähetä nyt' : 'Lähetä ryhmälle';

  return (
    <Screen>
      <H2>{existing ? 'Muokkaa tiedotetta' : 'Tiedote koko ryhmälle'}</H2>
      {sent ? (
        <Muted>
          Lähetetty {dayLabel(existing.send_at, today, tz).toLowerCase()} klo {clockTime(existing.send_at, tz)}. Muutos näkyy
          matkustajille merkinnällä ”muokattu”, eikä siitä lähetetä uutta ilmoitusta.
        </Muted>
      ) : (
        <Muted>Menee {pax} matkustajalle: etusivulle, chattiin ja push-ilmoituksena.</Muted>
      )}

      {!existing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {TEMPLATES.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              onPress={() => setBody(t)}
              style={{ borderWidth: 1.5, borderColor: c.line, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 }}>
              <Text style={{ color: c.fg, fontSize: 13 }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label="Otsikko" value={title} onChangeText={setTitle} maxLength={80} />
      <Field
        label="Viesti"
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Kirjoita tiedote"
        style={{ minHeight: 110, textAlignVertical: 'top' }}
      />

      {!sent ? (
        <View style={{ gap: space.s }}>
          <Body style={{ fontWeight: '700' }}>Milloin lähtee?</Body>
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <Chip label="Heti" selected={!later} onPress={() => setLater(false)} />
            <Chip label="Ajasta" selected={later} onPress={() => setLater(true)} />
          </View>
          {later ? (
            <View style={{ gap: space.s }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
                {days.map((d, i) => (
                  <Chip
                    key={d}
                    label={i === 0 ? 'Tänään' : i === 1 ? 'Huomenna' : dayLabel(`${d}T12:00:00Z`, today, 'UTC')}
                    selected={d === day}
                    onPress={() => setDay(d)}
                  />
                ))}
              </ScrollView>
              <Field
                label="Kellonaika (kohteen aikaa)"
                value={time}
                onChangeText={setTime}
                placeholder="18:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              {when ? <Muted>Matkustajat näkevät tiedotteen {when}.</Muted> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label={label} onPress={save} busy={busy} />
      {scheduledExisting ? (
        confirmCancel ? (
          <View style={{ gap: space.s }}>
            <Body>Perutaanko tiedote? Matkustajat eivät näe sitä.</Body>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button label="Peru tiedote" variant="danger" onPress={cancel} busy={busy} />
              <Button label="Ei" variant="ghost" onPress={() => setConfirmCancel(false)} />
            </View>
          </View>
        ) : (
          <Button label="Peru ajastettu tiedote" variant="danger" onPress={() => setConfirmCancel(true)} />
        )
      ) : null}
      <Button label="Takaisin" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

/** At least a minute from now, so the notice is not "scheduled" into the past. */
function isInFuture(iso: string) {
  return new Date(iso).getTime() > new Date().getTime() + 60_000;
}

/** The trip-local date of an instant. */
function localDate(iso: string, timeZone: string) {
  return tripClock(timeZone, new Date(iso)).date;
}
