import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Timeline } from '@/components/timeline';
import { Button, Chip, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { formatDay, tripDays } from '@/lib/time';
import { space } from '@/theme';

export default function Programme() {
  const { trip, role } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const days = tripDays(trip.starts_on, trip.ends_on);
  const [day, setDay] = useState(() => (days.includes(clock.date) ? clock.date : days[0]));
  const isGuide = role === 'guide';
  const isToday = day === clock.date;

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{isGuide ? 'Muokkaa ohjelmaa' : 'Viikon ohjelma'}</Eyebrow>
        <H1>{formatDay(day)}</H1>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
        {days.map((d) => {
          const [wd, date] = formatDay(d).split(' ');
          return <Chip key={d} sub={d === clock.date ? `${wd} ·` : wd} label={date.split('.')[0]} selected={d === day} onPress={() => setDay(d)} />;
        })}
      </ScrollView>
      <Timeline
        items={items.filter((i) => i.day === day)}
        nowTime={isToday ? clock.time : null}
        past={day < clock.date}
        onEdit={isGuide ? (it) => router.push({ pathname: '/edit-item', params: { id: it.id } }) : undefined}
      />
      {isGuide ? (
        <>
          <Button label="Lisää ohjelmakohta" variant="ghost" onPress={() => router.push({ pathname: '/edit-item', params: { day } })} />
          <Muted>Muutokset näkyvät heti kaikkien matkustajien sovelluksessa.</Muted>
        </>
      ) : (
        <Muted>Ohjelma päivittyy automaattisesti, kun opas tekee muutoksia.</Muted>
      )}
    </Screen>
  );
}
