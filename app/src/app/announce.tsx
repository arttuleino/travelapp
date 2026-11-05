import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Field, H2, Muted, Screen } from '@/components/ui';
import { useMembers } from '@/lib/chat';
import { postAnnouncement } from '@/lib/programme';
import { useMembership } from '@/lib/trip';
import { space, usePalette } from '@/theme';

const TEMPLATES = [
  'Muistutus: illan nouto hotellin edestä klo 20:15.',
  'Tuuli on yltynyt, huippuhissi on suljettu toistaiseksi.',
  'Lounaspaikka vaihtuu, tavataan klo 12:30.',
];

/** Guide: send a notice to the whole group. It appears on everyone's home screen and chat, and as a push notification. */
export default function Announce() {
  const c = usePalette();
  const { trip, role, display_name } = useMembership();
  const pax = useMembers(trip.id)
    .filter((m) => m.role === 'traveller')
    .reduce((s, m) => s + m.party_size, 0);
  const [title, setTitle] = useState('Tiedote');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role !== 'guide') {
    return (
      <Screen>
        <Muted>Vain opas voi lähettää tiedotteita.</Muted>
        <Button label="Takaisin" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  async function send() {
    if (!body.trim()) return setError('Kirjoita tiedotteen teksti.');
    setBusy(true);
    setError(null);
    try {
      await postAnnouncement(trip.id, title.trim() || 'Tiedote', body.trim(), display_name);
      router.back();
    } catch {
      setError('Tiedote ei lähtenyt. Tarkista verkkoyhteys ja yritä uudelleen.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H2>Tiedote koko ryhmälle</H2>
      <Muted>Menee {pax} matkustajalle: etusivulle, chattiin ja push-ilmoituksena.</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {TEMPLATES.map((t) => (
          <Pressable key={t} accessibilityRole="button" onPress={() => setBody(t)} style={{ borderWidth: 1.5, borderColor: c.line, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 }}>
            <Text style={{ color: c.fg, fontSize: 13 }}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Otsikko" value={title} onChangeText={setTitle} maxLength={80} />
      <Field label="Viesti" value={body} onChangeText={setBody} multiline placeholder="Kirjoita tiedote" style={{ minHeight: 110, textAlignVertical: 'top' }} />
      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label="Lähetä ryhmälle" onPress={send} busy={busy} />
      <Button label="Peruuta" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
