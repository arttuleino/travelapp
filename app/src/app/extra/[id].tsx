import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Eyebrow, H1, Muted, Screen } from '@/components/ui';
import { money } from '@/lib/cashbook';
import { useMembers } from '@/lib/chat';
import { checklistOrder, dueOf, summarize, type Extra, type PaymentMethod, type Signup } from '@/lib/extras-calc';
import { addSignups, recordPayment, removeSignup, undoPayment, useExtras, useSignups } from '@/lib/extras';
import { useI18n } from '@/lib/i18n';
import { formatDay } from '@/lib/time';
import { useMembership } from '@/lib/trip';
import type { Member } from '@/lib/types';
import { clockTime } from '@/lib/unread';
import { space, usePalette } from '@/theme';

type Row = Signup & { name: string; member?: Member };

/** Guide at the meeting point: who has paid for the extra, who still owes and how much. */
export default function ExtraChecklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip, role } = useMembership();
  const { extras, loading } = useExtras(trip.id);
  const signups = useSignups(trip.id);
  const members = useMembers(trip.id);
  const [adding, setAdding] = useState(false);
  const extra = extras.find((x) => x.id === id);

  if (role !== 'guide')
    return (
      <Screen>
        <Muted>{t('onlyGuideFinance')}</Muted>
      </Screen>
    );
  if (loading) return null;
  if (!extra)
    return (
      <Screen>
        <Body>{t('extraNotFound')}</Body>
        <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );

  const byId = new Map(members.map((m) => [m.id, m]));
  const mine = signups.filter((s) => s.extra_id === extra.id);
  const rows: Row[] = checklistOrder(
    mine.map((s) => ({
      ...s,
      name: byId.get(s.member_id)?.display_name ?? '–',
      member: byId.get(s.member_id),
    })),
  );
  const unpaid = rows.filter((r) => r.status === 'unpaid');
  const paid = rows.filter((r) => r.status !== 'unpaid');
  const sum = summarize(extra, mine);
  const eur = (n: number) => `${money(n, locale)} €`;
  const when = [formatDay(extra.day, locale), extra.starts_at?.slice(0, 5)].filter(Boolean).join(' ');

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{`${when} · ${t('perPerson', { price: money(Number(extra.price), locale) })}`}</Eyebrow>
        <H1>{extra.title}</H1>
        <Muted>{t('extraParticipants', { n: sum.bookings, persons: sum.persons })}</Muted>
      </View>

      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Total label={t('outstanding')} value={eur(sum.outstanding)} color={sum.outstanding ? c.live : c.fg} />
        <Total label={t('collected')} value={eur(sum.collected)} color={c.ok} />
        <Total label={t('prepaidTotal')} value={eur(sum.prepaid)} color={c.fg} />
      </View>

      {rows.length ? (
        <>
          <Eyebrow>{t('unpaidSection', { n: unpaid.length })}</Eyebrow>
          {unpaid.length === 0 ? <Text style={{ color: c.ok, fontWeight: '800' }}>✓ {t('allPaid')}</Text> : null}
          {unpaid.map((r) => (
            <UnpaidRow key={r.id} row={r} extra={extra} />
          ))}
          {paid.length ? <Eyebrow>{t('paidSection', { n: paid.length })}</Eyebrow> : null}
          {paid.map((r) => (
            <PaidRow key={r.id} row={r} extra={extra} />
          ))}
        </>
      ) : null}

      {adding ? (
        <AddParticipants extra={extra} members={members} taken={new Set(mine.map((s) => s.member_id))} onDone={() => setAdding(false)} />
      ) : (
        <Button label={`+ ${t('addParticipants')}`} variant="ghost" onPress={() => setAdding(true)} />
      )}
      <Muted>{t('paidToCashbook')}</Muted>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Button small label={t('editExtra')} variant="ghost" onPress={() => router.push({ pathname: '/extra-edit', params: { id: extra.id } })} />
        <Button small label={t('back')} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ flex: 1, padding: space.m, gap: 2 }}>
      <Muted numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </Muted>
      <Text
        style={{
          color,
          fontSize: 17,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>
    </Card>
  );
}

function Who({ row }: { row: Row }) {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Body style={{ fontWeight: '700' }} numberOfLines={1}>
        {row.name}
      </Body>
      <Muted numberOfLines={1}>
        {[t('persons', { n: row.persons }), row.member?.room && t('room', { room: row.member.room })].filter(Boolean).join(' · ')}
      </Muted>
    </View>
  );
}

function UnpaidRow({ row, extra }: { row: Row; extra: Extra }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState<PaymentMethod | 'remove' | null>(null);
  const [error, setError] = useState(false);

  async function pay(method: PaymentMethod) {
    setBusy(method);
    setError(false);
    try {
      await recordPayment(row.id, method);
    } catch {
      setError(true);
    }
    setBusy(null);
  }

  return (
    <Card style={{ gap: space.s, borderLeftWidth: 4, borderLeftColor: c.live }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <Who row={row} />
        <Text
          style={{
            color: c.live,
            fontSize: 17,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>{`${money(dueOf(extra, row), locale)} €`}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Button small label={t('payMobile')} onPress={() => pay('mobile')} busy={busy === 'mobile'} disabled={!!busy} style={{ flex: 1 }} />
        <Button small label={t('payCash')} onPress={() => pay('cash')} busy={busy === 'cash'} disabled={!!busy} style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('removeFromExtra')}
          disabled={!!busy}
          onPress={() => {
            setBusy('remove');
            removeSignup(row.id)
              .catch(() => setError(true))
              .finally(() => setBusy(null));
          }}
          style={{ justifyContent: 'center', paddingHorizontal: space.s }}>
          <Text style={{ color: c.muted, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      {error ? <Text style={{ color: c.live }}>{t('paymentFailed')}</Text> : null}
    </Card>
  );
}

function PaidRow({ row, extra }: { row: Row; extra: Extra }) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const { trip } = useMembership();
  const [busy, setBusy] = useState(false);
  const amount = row.amount_paid == null ? dueOf(extra, row) : Number(row.amount_paid);
  const how =
    row.status === 'prepaid'
      ? t('prepaidLabel')
      : [row.method === 'mobile' ? t('payMobile') : t('payCash'), row.paid_at && clockTime(row.paid_at, trip.timezone)].filter(Boolean).join(' · ');

  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.m,
        borderLeftWidth: 4,
        borderLeftColor: c.ok,
      }}>
      <Who row={row} />
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text
          style={{
            color: c.ok,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>{`✓ ${money(amount, locale)} €`}</Text>
        <Muted style={{ fontSize: 12 }}>{how}</Muted>
        {row.status === 'paid' ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setBusy(true);
              undoPayment(row.id).finally(() => setBusy(false));
            }}>
            <Text
              style={{
                color: c.muted,
                fontSize: 12,
                fontWeight: '700',
                textDecorationLine: 'underline',
              }}>
              {t('undo')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function AddParticipants({ extra, members, taken, onDone }: { extra: Extra; members: Member[]; taken: Set<string>; onDone: () => void }) {
  const c = usePalette();
  const { t } = useI18n();
  const free = members.filter((m) => m.role === 'traveller' && !taken.has(m.id));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function done() {
    setBusy(true);
    try {
      await addSignups(
        extra.id,
        free.filter((m) => picked.has(m.id)),
      );
      onDone();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <Card tone="cream" style={{ gap: space.s }}>
      <Body style={{ fontWeight: '700' }}>{t('addParticipants')}</Body>
      {free.length === 0 ? <Muted>{t('noGuestMatch')}</Muted> : null}
      {free.map((m) => {
        const on = picked.has(m.id);
        return (
          <Pressable
            key={m.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => toggle(m.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.m,
              paddingVertical: 6,
            }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: on ? c.brandInk : c.line,
                backgroundColor: on ? c.brand : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {on ? <Text style={{ color: c.brandInk, fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
            </View>
            <Body style={{ flex: 1 }}>{m.display_name}</Body>
            <Muted>{t('persons', { n: m.party_size })}</Muted>
          </Pressable>
        );
      })}
      {error ? <Text style={{ color: c.live }}>{t('saveFailed')}</Text> : null}
      <Button label={picked.size ? `${t('doneAdding')} (${picked.size})` : t('doneAdding')} onPress={done} busy={busy} />
    </Card>
  );
}
