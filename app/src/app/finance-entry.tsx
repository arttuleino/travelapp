import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Button, Chip, Field, H2, Muted, Screen } from '@/components/ui';
import { KINDS, accountsFor, parseAmount, takesArrangement, type CashEntry, type EntryAccount, type EntryKind } from '@/lib/cashbook';
import { accountLabel, deleteEntry, kindLabel, saveEntry, saveTransfer, useCashEntries } from '@/lib/finance';
import { useI18n } from '@/lib/i18n';
import { formatDay, tripDays, weekdayShort } from '@/lib/time';
import { useMembership, useProgramme, useTripClock } from '@/lib/trip';
import { space, usePalette } from '@/theme';

/** Guide: record a cost, income or transfer in the trip cash book, or edit one (`?id=`). */
export default function FinanceEntry() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const { trip, role } = useMembership();
  const { entries, loading } = useCashEntries(trip.id);
  const existing = id ? (entries.find((e) => e.id === id) ?? null) : null;

  if (role !== 'guide') return <Message text={t('onlyGuideFinance')} />;
  if (id && loading) return null;
  if (id && !existing) return <Message text={t('entryNotFound')} />;
  // A transfer is edited as one: both of its vouchers.
  const pair = existing?.transfer_id ? entries.filter((e) => e.transfer_id === existing.transfer_id) : [];
  return <EntryForm key={existing?.id ?? 'new'} existing={existing} pair={pair} />;
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

function EntryForm({ existing, pair }: { existing: CashEntry | null; pair: CashEntry[] }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip } = useMembership();
  const clock = useTripClock(trip.timezone);
  const { items } = useProgramme(trip.id);
  const days = tripDays(trip.starts_on, trip.ends_on);
  const out = pair.find((e) => Number(e.amount) < 0);
  const into = pair.find((e) => Number(e.amount) > 0);

  const [kind, setKind] = useState<EntryKind>(existing?.kind ?? 'cost_arrangement');
  const [amount, setAmount] = useState(existing ? Math.abs(Number(existing.amount)).toFixed(2).replace('.', ',') : '');
  const [day, setDay] = useState(existing?.entry_date ?? (days.includes(clock.date) ? clock.date : days[0]));
  const [account, setAccount] = useState<EntryAccount>(existing && existing.kind !== 'transfer' ? existing.account : 'cash');
  const [from, setFrom] = useState<EntryAccount>(out?.account ?? 'bank');
  const [to, setTo] = useState<EntryAccount>(into?.account ?? 'cash');
  const [itemId, setItemId] = useState<string | null>(existing?.programme_item_id ?? null);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const transfer = kind === 'transfer';
  // The kind can't switch between a transfer (two vouchers) and a single entry once recorded.
  const kinds = existing ? KINDS.filter((k) => (k === 'transfer') === (existing.kind === 'transfer')) : KINDS;
  const accounts = accountsFor(kind);
  const pickedAccount = accounts.includes(account) ? account : accounts[0];
  // Arrangements are the trip's programme items, on the chosen day first.
  const dayItems = items.filter((i) => i.day === day);
  const otherItems = items.filter((i) => i.day !== day);
  const pickedItem = takesArrangement(kind) ? itemId : null;

  async function save() {
    const sum = parseAmount(amount);
    if (!sum) return setError(t('needAmount'));
    if (kind === 'income_arrangement' && !pickedItem) return setError(t('needArrangement'));
    if (transfer && from === to) return setError(t('sameAccount'));
    setBusy(true);
    setError(null);
    try {
      if (transfer) await saveTransfer(trip.id, { from, to, amount: sum, entry_date: day, comment }, existing?.transfer_id ?? undefined);
      else
        await saveEntry(
          trip.id,
          { kind: kind as Exclude<EntryKind, 'transfer'>, account: pickedAccount, amount: sum, entry_date: day, comment, programme_item_id: pickedItem },
          existing?.id,
        );
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
      await deleteEntry(existing);
      router.back();
    } catch {
      setError(t('deleteFailed'));
      setBusy(false);
    }
  }

  const vouchers = (pair.length ? pair : existing ? [existing] : []).map((e) => e.voucher_no).join(', ');

  return (
    <Screen>
      <H2>{existing ? t('editEntry') : t('newEntry')}</H2>
      {existing ? <Muted>{t('voucher', { n: vouchers })}</Muted> : null}

      <Group label={t('kind')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {kinds.map((k) => (
            <Chip key={k} small label={kindLabel(t, k)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      </Group>

      <Field
        label={t('amountEur')}
        value={amount}
        onChangeText={setAmount}
        placeholder="0,00"
        keyboardType="decimal-pad"
        maxLength={12}
      />

      <Group label={t('day')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
          {days.map((d) => (
            <Chip key={d} sub={weekdayShort(d, locale)} label={String(Number(d.slice(8)))} selected={d === day} onPress={() => setDay(d)} />
          ))}
        </ScrollView>
      </Group>

      {transfer ? (
        <>
          <AccountPicker label={t('fromAccount')} options={accounts} value={from} onChange={setFrom} />
          <AccountPicker label={t('toAccount')} options={accounts} value={to} onChange={setTo} />
        </>
      ) : (
        <AccountPicker label={t('account')} options={accounts} value={pickedAccount} onChange={setAccount} />
      )}

      {takesArrangement(kind) ? (
        <Group label={t('arrangement')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {kind !== 'income_arrangement' ? <Chip small label={t('noArrangement')} selected={!pickedItem} onPress={() => setItemId(null)} /> : null}
            {[...dayItems, ...otherItems].map((i) => (
              <Chip
                key={i.id}
                small
                label={i.day === day ? i.title : `${i.title} · ${formatDay(i.day, locale)}`}
                selected={pickedItem === i.id}
                onPress={() => setItemId(i.id)}
              />
            ))}
          </View>
        </Group>
      ) : null}

      <Field label={t('comment')} value={comment} onChangeText={setComment} placeholder={t('commentPlaceholder')} maxLength={120} />

      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label={existing ? t('save') : t('saveEntry')} onPress={save} busy={busy} />
      {existing ? (
        confirmDelete ? (
          <View style={{ gap: space.s }}>
            <Body>{t('deleteEntryConfirm', { n: vouchers })}</Body>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <Button label={t('delete')} variant="danger" onPress={remove} busy={busy} />
              <Button label={t('no')} variant="ghost" onPress={() => setConfirmDelete(false)} />
            </View>
          </View>
        ) : (
          <Button label={t('deleteEntry')} variant="danger" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.s }}>
      <Body style={{ fontWeight: '700' }}>{label}</Body>
      {children}
    </View>
  );
}

function AccountPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: EntryAccount[];
  value: EntryAccount;
  onChange: (a: EntryAccount) => void;
}) {
  const { t } = useI18n();
  return (
    <Group label={label}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {options.map((a) => (
          <Chip key={a} small label={accountLabel(t, a)} selected={value === a} onPress={() => onChange(a)} />
        ))}
      </View>
    </Group>
  );
}
