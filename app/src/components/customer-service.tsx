import { Linking, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Button, Card, H2, Muted } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { CUSTOMER_SERVICE, hoursText, isOpen, marketFor } from '@/lib/support';
import { space, usePalette } from '@/theme';

/** The operator's customer service for the traveller's booking market (Finland, Sweden or Norway). */
export function CustomerService({ market }: { market: string | null }) {
  const c = usePalette();
  const { t, lang } = useI18n();
  const m = marketFor(market, lang);
  const s = CUSTOMER_SERVICE[m];
  const open = isOpen(s, new Date());
  const go = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <Card style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.m }}>
        <H2>{t('supportTitle')}</H2>
        <Text style={{ color: open ? c.ok : c.muted, fontSize: 13, fontWeight: '700' }}>{open ? `● ${t('openNow')}` : t('closedNow')}</Text>
      </View>
      <Muted>{s.brand}</Muted>
      <Body>{t('supportHours', { hours: hoursText(s), tz: t(m === 'FI' ? 'tzFI' : m === 'SE' ? 'tzSE' : 'tzNO') })}</Body>
      <Button label={t('callPhone', { phone: s.phoneLocal })} onPress={() => go(`tel:${s.phone}`)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <Button small variant="ghost" label={t('sendEmail')} onPress={() => go(`mailto:${s.email}`)} />
        <Button small variant="ghost" label={`${t('contactPage')} ›`} onPress={() => go(s.contactUrl)} />
      </View>
      <Muted>{s.email}</Muted>
      <Muted>{t('supportHint')}</Muted>
    </Card>
  );
}
