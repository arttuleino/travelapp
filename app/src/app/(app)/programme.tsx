import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Timeline } from '@/components/timeline';
import { Button, Chip, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { useI18n } from '@/lib/i18n';
import { formatDay, tripDays, weekdayShort } from '@/lib/time';
import { space } from '@/theme';

export default function Programme() {
  const { t, locale } = useI18n();
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
        <Eyebrow>{isGuide ? t('editProgramme') : t('weekProgramme')}</Eyebrow>
        <H1>{formatDay(day, locale)}</H1>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
        {days.map((d) => {
          const wd = weekdayShort(d, locale);
          return <Chip key={d} sub={d === clock.date ? `${wd} ·` : wd} label={String(Number(d.slice(8)))} selected={d === day} onPress={() => setDay(d)} />;
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
          <Button label={t('addItem')} variant="ghost" onPress={() => router.push({ pathname: '/edit-item', params: { day } })} />
          <Muted>{t('guideProgrammeHint')}</Muted>
        </>
      ) : (
        <Muted>{t('travellerProgrammeHint')}</Muted>
      )}
    </Screen>
  );
}
