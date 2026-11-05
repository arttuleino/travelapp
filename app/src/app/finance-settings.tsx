import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Body, Button, Field, H2, Muted, Screen } from '@/components/ui';
import { parseBalance, type CashBook } from '@/lib/cashbook';
import { accountLabel, saveCashBook, useCashBook } from '@/lib/finance';
import { useI18n } from '@/lib/i18n';
import { useMembership } from '@/lib/trip';
import { usePalette } from '@/theme';

/** Guide: the cash book's details for the weekly report and each account's opening balance. */
export default function FinanceSettings() {
  const { t } = useI18n();
  const { trip, role } = useMembership();
  const { book, loading } = useCashBook(trip.id);

  if (role !== 'guide') {
    return (
      <Screen>
        <Body>{t('onlyGuideFinance')}</Body>
        <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (loading) return null;
  return <SettingsForm book={book} />;
}

const asText = (n: number | undefined) => (n ? Number(n).toFixed(2).replace('.', ',') : '0');

function SettingsForm({ book }: { book: CashBook | null }) {
  const c = usePalette();
  const { t } = useI18n();
  const { trip, display_name } = useMembership();
  const [destNumber, setDestNumber] = useState(book?.dest_number ?? '');
  const [department, setDepartment] = useState(book?.department ?? '');
  const [responsible, setResponsible] = useState(book?.responsible || display_name);
  const [bank, setBank] = useState(asText(book?.opening_bank));
  const [cash, setCash] = useState(asText(book?.opening_cash));
  const [mobile, setMobile] = useState(asText(book?.opening_mobile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const [b, ca, m] = [parseBalance(bank), parseBalance(cash), parseBalance(mobile)];
    if (b === null || ca === null || m === null) return setError(t('needBalance'));
    setBusy(true);
    setError(null);
    try {
      await saveCashBook(trip.id, {
        dest_number: destNumber.trim(),
        department: department.trim(),
        responsible: responsible.trim(),
        opening_bank: b,
        opening_cash: ca,
        opening_mobile: m,
      });
      router.back();
    } catch {
      setError(t('saveFailed'));
      setBusy(false);
    }
  }

  const balance = { keyboardType: 'numbers-and-punctuation' as const, maxLength: 12, placeholder: '0' };
  return (
    <Screen>
      <H2>{t('cashBookSettings')}</H2>
      <Field label={t('destNumber')} value={destNumber} onChangeText={setDestNumber} placeholder="274" maxLength={20} />
      <Field label={t('department')} value={department} onChangeText={setDepartment} placeholder="Talvi, Charter" maxLength={60} />
      <Field label={t('responsible')} value={responsible} onChangeText={setResponsible} maxLength={60} />
      <Muted>{t('openingHint')}</Muted>
      <Field label={t('openingOf', { account: accountLabel(t, 'bank') })} value={bank} onChangeText={setBank} {...balance} />
      <Field label={t('openingOf', { account: accountLabel(t, 'cash') })} value={cash} onChangeText={setCash} {...balance} />
      <Field label={t('openingOf', { account: accountLabel(t, 'mobile') })} value={mobile} onChangeText={setMobile} {...balance} />
      {error ? <Text style={{ color: c.live }}>{error}</Text> : null}
      <Button label={t('save')} onPress={save} busy={busy} />
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
