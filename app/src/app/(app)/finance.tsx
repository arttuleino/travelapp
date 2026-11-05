import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { Body, Button, Card, Chip, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { ACCOUNTS, arrangementSummaries, balances, isCost, isIncome, money, newestFirst, reportCsv, type Account, type CashEntry } from '@/lib/cashbook';
import { accountLabel, kindLabel, reportLabels, useCashBook, useCashEntries } from '@/lib/finance';
import { useI18n } from '@/lib/i18n';
import { formatDay, formatRange } from '@/lib/time';
import { useMembership, useProgramme } from '@/lib/trip';
import type { ProgrammeItem } from '@/lib/types';
import { space, usePalette } from '@/theme';

type Tab = 'entries' | 'arrangements' | 'report';
type Filter = 'all' | 'income' | 'costs' | 'transfers';

/** Guide: the trip cash book, modelled on the operator's weekly cash report. */
export default function Finance() {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip, role, display_name } = useMembership();
  const { book } = useCashBook(trip.id);
  const { entries } = useCashEntries(trip.id);
  const { items } = useProgramme(trip.id);
  const [tab, setTab] = useState<Tab>('entries');

  if (role !== 'guide') return <Screen><Muted>{t('onlyGuideFinance')}</Muted></Screen>;

  const b = balances(book, entries);
  const eur = (n: number, sign = false) => `${money(n, locale, sign)} €`;
  const arrangementName = arrangementNamer(items, locale, t('otherArrangements'));
  const meta = t('financeMeta', {
    dest: trip.destination,
    range: formatRange(trip.starts_on, trip.ends_on, locale),
    who: book?.responsible || display_name,
    currency: book?.currency ?? 'EUR',
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.m }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Eyebrow>{book?.dest_number ? `${t('financeEyebrow')} · ${book.dest_number}` : t('financeEyebrow')}</Eyebrow>
          <H1>{t('financeTitle')}</H1>
        </View>
        <Button small label={`+ ${t('addEntry')}`} onPress={() => router.push('/finance-entry')} />
      </View>
      <Muted>{meta}</Muted>

      <View style={{ flexDirection: 'row', gap: space.s }}>
        {ACCOUNTS.map((a) => (
          <Card key={a} style={{ flex: 1, padding: space.m, gap: 2 }}>
            <Muted numberOfLines={1}>{accountLabel(t, a)}</Muted>
            <Text style={{ color: c.fg, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
              {money(b.closing[a], locale)}
            </Text>
            <Text style={{ color: b.result[a] < 0 ? c.live : c.ok, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {money(b.result[a], locale, true)}
            </Text>
            <Muted style={{ fontSize: 11 }} numberOfLines={1}>
              {t('inPeriod')}
            </Muted>
          </Card>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Muted>{t('totalBalance')}</Muted>
        <Text style={{ color: c.fg, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{eur(b.total)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Chip small label={t('segEntries')} selected={tab === 'entries'} onPress={() => setTab('entries')} />
        <Chip small label={t('segArrangements')} selected={tab === 'arrangements'} onPress={() => setTab('arrangements')} />
        <Chip small label={t('segReport')} selected={tab === 'report'} onPress={() => setTab('report')} />
      </View>

      {tab === 'entries' ? <EntryList entries={entries} arrangementName={arrangementName} /> : null}
      {tab === 'arrangements' ? <Arrangements entries={entries} items={items} arrangementName={arrangementName} /> : null}
      {tab === 'report' ? <Report entries={entries} arrangementName={arrangementName} /> : null}
    </Screen>
  );
}

/** "Fondue-ilta · ke 17.2." for a programme item id. */
function arrangementNamer(items: ProgrammeItem[], locale: string, missing: string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return (id: string | null, short = false) => {
    if (!id) return '';
    const it = byId.get(id);
    if (!it) return missing;
    return short ? it.title : `${it.title} · ${formatDay(it.day, locale)}`;
  };
}

function EntryList({ entries, arrangementName }: { entries: CashEntry[]; arrangementName: (id: string | null, short?: boolean) => string }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const keep = (e: CashEntry) =>
    filter === 'all' || (filter === 'income' && isIncome(e.kind)) || (filter === 'costs' && isCost(e.kind)) || (filter === 'transfers' && e.kind === 'transfer');
  const list = newestFirst(entries.filter(keep));

  return (
    <View style={{ gap: space.s }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {(['all', 'income', 'costs', 'transfers'] as const).map((f) => (
          <Chip
            key={f}
            small
            label={t(f === 'all' ? 'filterAll' : f === 'income' ? 'filterIncome' : f === 'costs' ? 'filterCosts' : 'filterTransfers')}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
      {list.length === 0 ? <Muted>{t('noEntries')}</Muted> : null}
      {list.map((e) => {
        const amount = Number(e.amount);
        const detail = [kindLabel(t, e.kind), accountLabel(t, e.account), formatDay(e.entry_date, locale), arrangementName(e.programme_item_id, true)]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/finance-entry', params: { id: e.id } })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.m,
              padding: space.m,
              borderRadius: 14,
              backgroundColor: c.card,
              opacity: pressed ? 0.75 : 1,
            })}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body style={{ fontWeight: '700' }} numberOfLines={1}>
                {e.comment || kindLabel(t, e.kind)}
              </Body>
              <Muted numberOfLines={2}>{`${t('voucher', { n: e.voucher_no })} · ${detail}`}</Muted>
            </View>
            <Text style={{ color: amount > 0 ? c.ok : c.fg, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] }}>
              {money(amount, locale, true)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Arrangements({
  entries,
  items,
  arrangementName,
}: {
  entries: CashEntry[];
  items: ProgrammeItem[];
  arrangementName: (id: string | null, short?: boolean) => string;
}) {
  const c = usePalette();
  const { t, locale } = useI18n();
  // Programme order; entries for deleted programme items come last.
  const order = new Map(items.map((i, n) => [i.id, n]));
  const sums = arrangementSummaries(entries).sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const eur = (n: number) => `${money(n, locale)} €`;

  return (
    <View style={{ gap: space.s }}>
      {sums.length === 0 ? <Muted>{t('noArrangements')}</Muted> : null}
      {sums.map((s) => {
        const pct = s.income + s.cost > 0 ? s.income / (s.income + s.cost) : 0;
        return (
          <Card key={s.id} style={{ gap: space.s }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
              <Body style={{ fontWeight: '700', flexShrink: 1 }}>{arrangementName(s.id)}</Body>
              <Text style={{ color: s.net < 0 ? c.live : c.ok, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{`${money(s.net, locale, true)} €`}</Text>
            </View>
            {/* Share of income (green) against costs (red). */}
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.live, opacity: 0.85, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: c.ok }} />
            </View>
            <Muted>{t('incomeCost', { income: eur(s.income), cost: eur(s.cost), n: s.count })}</Muted>
          </Card>
        );
      })}
      <Muted>{t('prepaidHint')}</Muted>
    </View>
  );
}

function Report({ entries, arrangementName }: { entries: CashEntry[]; arrangementName: (id: string | null, short?: boolean) => string }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip, display_name } = useMembership();
  const { book } = useCashBook(trip.id);
  const b = balances(book, entries);
  const m = (n: number) => money(n, locale);

  const facts: [string, string][] = [
    [t('destNumber'), book?.dest_number || '–'],
    [t('department'), book?.department || '–'],
    [t('responsible'), book?.responsible || display_name],
    [t('currency'), book?.currency ?? 'EUR'],
    [t('period'), formatRange(trip.starts_on, trip.ends_on, locale)],
  ];

  function share() {
    const csv = reportCsv(book, entries, reportLabels(t, arrangementName));
    const title = `${t('financeEyebrow')} ${trip.destination} ${trip.starts_on}`;
    Share.share({ title, message: csv }).catch(() => {});
  }

  const cell = { flex: 1, textAlign: 'right' as const, color: c.fg, fontVariant: ['tabular-nums' as const], fontSize: 13 };
  return (
    <View style={{ gap: space.m }}>
      <Card style={{ gap: space.s }}>
        {facts.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.m }}>
            <Muted>{k}</Muted>
            <Body style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Body>
          </View>
        ))}
      </Card>

      <Card style={{ gap: space.s }}>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Muted style={{ flex: 1.1 }}>{t('account')}</Muted>
          <Muted style={{ flex: 1, textAlign: 'right' }}>{t('openingBalance')}</Muted>
          <Muted style={{ flex: 1, textAlign: 'right' }}>{t('periodResult')}</Muted>
          <Muted style={{ flex: 1, textAlign: 'right' }}>{t('closingBalance')}</Muted>
        </View>
        {ACCOUNTS.map((a: Account) => (
          <View key={a} style={{ flexDirection: 'row', gap: space.s }}>
            <Text style={{ flex: 1.1, color: c.fg, fontSize: 13 }}>{accountLabel(t, a)}</Text>
            <Text style={cell}>{m(b.opening[a])}</Text>
            <Text style={cell}>{m(b.result[a])}</Text>
            <Text style={[cell, { fontWeight: '800' }]}>{m(b.closing[a])}</Text>
          </View>
        ))}
      </Card>

      <Button label={t('shareReport')} onPress={share} disabled={entries.length === 0} />
      <Button label={t('editCashBook')} variant="ghost" onPress={() => router.push('/finance-settings')} />
      <Muted>{t('reportHint')}</Muted>
    </View>
  );
}
