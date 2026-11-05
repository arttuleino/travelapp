import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { Body, Button, Chip, Field, H2, Muted, Screen } from '@/components/ui';
import { changeNotice, deleteItem, postAnnouncement, saveItem, type ItemInput } from '@/lib/programme';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { formatDay, hhmm, normalizeTime, tripDays } from '@/lib/time';
import type { ProgrammeItem } from '@/lib/types';
import { space, usePalette } from '@/theme';

export default function EditItem() {
  const { id, day: dayParam } = useLocalSearchParams<{ id?: string; day?: string }>();
  const { trip, role } = useMembership();
  const { items, loading } = useProgramme(trip.id);
  const existing = id ? (items.find((i) => i.id === id) ?? null) : null;

  if (role !== 'guide') return <Message text="Vain opas voi muokata ohjelmaa." />;
  if (id && loading) return null;
  if (id && !existing) return <Message text="Ohjelmakohtaa ei löytynyt. Se on ehkä poistettu." />;
  return <EditForm key={existing?.id ?? 'new'} existing={existing} initialDay={dayParam} />;
}

function Message({ text }: { text: string }) {
  return (
    <Screen>
      <Body>{text}</Body>
      <Button label="Takaisin" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function EditForm({ existing, initialDay }: { existing: ProgrammeItem | null; initialDay?: string }) {
  const c = usePalette();
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
    if (!normTime) return setError('Anna kellonaika muodossa 09:15.');
    if (!title.trim()) return setError('Anna ohjelmakohdalle otsikko.');
    setBusy(true);
    setError(null);
    const input: ItemInput = { trip_id: trip.id, day, starts_at: normTime, title: title.trim(), details: details.trim() };
    try {
      await saveItem(input, existing?.id);
      if (notify) {
        const n = changeNotice(existing, input);
        await postAnnouncement(trip.id, n.title, n.body, display_name);
      }
      router.back();
    } catch {
      setError('Tallennus ei onnistunut. Tarkista verkkoyhteys ja yritä uudelleen.');
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteItem(existing.id);
      if (notify) {
        const n = changeNotice(existing, null);
        await postAnnouncement(trip.id, n.title, n.body, display_name);
      }
      router.back();
    } catch {
      setError('Poisto ei onnistunut. Yritä uudelleen.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H2>{existing ? 'Muokkaa ohjelmakohtaa' : 'Uusi ohjelmakohta'}</H2>
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.fg, fontWeight: '600', fontSize: 14 }}>Päivä</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
          {days.map((d) => {
            const [wd, date] = formatDay(d).split(' ');
            return <Chip key={d} sub={wd} label={date.split('.')[0]} selected={d === day} onPress={() => pickDay(d)} />;
          })}
        </ScrollView>
      </View>
      <Field label="Kellonaika" value={time} onChangeText={setTime} placeholder="09:15" keyboardType="numbers-and-punctuation" maxLength={5} />
      <Field label="Otsikko" value={title} onChangeText={setTitle} placeholder="esim. Opastettu lasku" maxLength={200} />
      <Field label="Lisätiedot" value={details} onChangeText={setDetails} placeholder="esim. kokoontumispaikka" multiline />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m }}>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>Ilmoita ryhmälle</Body>
          <Muted>Muutos näkyy matkustajien etusivulla ilmoituksena.</Muted>
        </View>
        <Switch value={notify} onValueChange={setNotify} trackColor={{ true: c.ok, false: c.pillOff }} accessibilityLabel="Ilmoita muutoksesta ryhmälle" />
      </View>
      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label="Tallenna" onPress={save} busy={busy} />
      {existing ? (
        confirmDelete ? (
          <View style={{ gap: space.s }}>
            <Body>Poistetaanko “{existing.title}” ohjelmasta?</Body>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button label="Poista" variant="danger" onPress={remove} busy={busy} />
              <Button label="Peruuta" variant="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <Button label="Poista ohjelmakohta" variant="ghost" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
      <Button label="Peruuta" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
