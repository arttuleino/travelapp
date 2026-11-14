import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';

import { Text } from '@/components/text';
import { TopBar } from '@/components/top-bar';
import { fontFamily } from '@/fonts';
import { AiGuideError, askAiGuide, historyFor, type AiSource } from '@/lib/ai-guide';
import { sendMessage } from '@/lib/chat';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { radius, space, usePalette } from '@/theme';

type Turn = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** assistant: the question it answers */
  question?: string;
  sources?: AiSource[];
  handoff?: boolean;
  handedOff?: boolean;
  failed?: boolean;
  pending?: boolean;
};

const SOURCE_KEY: Record<AiSource, MessageKey> = {
  programme: 'aiSrcProgramme',
  hotel: 'aiSrcHotel',
  flights: 'aiSrcFlights',
  answer_bank: 'aiSrcAnswerBank',
  announcements: 'aiSrcAnnouncements',
  guide: 'aiSrcGuide',
};

// The conversation lives only on this device and only while the app runs, one per trip.
const sessions = new Map<string, Turn[]>();
let nextId = 1;

type Props = { header: ReactNode; tripId: string; conversationId: string };

/** Traveller: questions to the AI guide, answered from the trip's own data; hard ones go to the human guide. */
export function AiGuideView({ header, tripId, conversationId }: Props) {
  const c = usePalette();
  const { t, lang } = useI18n();
  const scroll = useRef<ScrollViewInstance>(null);
  const [turns, setTurns] = useState<Turn[]>(() => sessions.get(tripId) ?? []);
  const [draft, setDraft] = useState('');
  const busy = turns.some((x) => x.pending);

  useEffect(() => {
    sessions.set(tripId, turns);
  }, [tripId, turns]);

  async function ask(text = draft) {
    const question = text.trim();
    if (!question || busy) return;
    const history = historyFor(turns.filter((x) => !x.pending));
    const pending: Turn = { id: nextId++, role: 'assistant', text: '', question, pending: true };
    setTurns((all) => [...all, { id: nextId++, role: 'user', text: question }, pending]);
    setDraft('');
    let done: Turn;
    try {
      const a = await askAiGuide(tripId, question, history, lang);
      done = { ...pending, pending: false, text: a.answer || t('aiNoAnswer'), sources: a.sources, handoff: a.handoff || !a.answer };
    } catch (e) {
      const reason = e instanceof AiGuideError ? e.reason : 'failed';
      const key: MessageKey = reason === 'unavailable' ? 'aiUnavailable' : reason === 'busy' ? 'aiBusy' : 'aiFailed';
      done = { ...pending, pending: false, failed: true, text: t(key), handoff: reason === 'unavailable' };
    }
    setTurns((all) => all.map((x) => (x.id === pending.id ? done : x)));
  }

  async function handOff(turn: Turn) {
    if (!turn.question || turn.handedOff) return;
    setTurns((all) => all.map((x) => (x.id === turn.id ? { ...x, handedOff: true } : x)));
    try {
      await sendMessage(conversationId, t('aiHandoffMessage', { question: turn.question }));
    } catch {
      setTurns((all) => all.map((x) => (x.id === turn.id ? { ...x, handedOff: false } : x)));
    }
  }

  const quick = [t('aiQuick1'), t('aiQuick2'), t('aiQuick3')];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: c.line }]}>{header}</View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.feed}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.bubble, styles.left, { backgroundColor: c.card, borderColor: c.line }]}>
            <Text style={[styles.who, { color: c.fg }]}>✦ {t('aiGuide')}</Text>
            <Text style={{ color: c.fg, fontSize: 15 }}>{t('aiIntro')}</Text>
          </View>
          {turns.map((x) =>
            x.role === 'user' ? (
              <View key={x.id} style={[styles.bubble, styles.right, { backgroundColor: c.brand, borderColor: c.brand }]}>
                <Text style={{ color: c.brandInk, fontSize: 15 }}>{x.text}</Text>
              </View>
            ) : (
              <View key={x.id} style={[styles.bubble, styles.left, { backgroundColor: c.card, borderColor: c.line }]}>
                <Text style={[styles.who, { color: c.fg }]}>✦ {t('aiGuide')}</Text>
                <Text style={{ color: x.failed ? c.muted : c.fg, fontSize: 15, fontStyle: x.pending ? 'italic' : 'normal' }}>
                  {x.pending ? t('aiThinking') : x.text}
                </Text>
                {x.sources?.length ? (
                  <Text style={[styles.meta, { color: c.muted }]}>{t('aiSources', { list: x.sources.map((s) => t(SOURCE_KEY[s])).join(' · ') })}</Text>
                ) : null}
                {x.handoff && !x.pending ? (
                  x.handedOff ? (
                    <Text style={[styles.meta, { color: c.ok, fontWeight: '700' }]}>✓ {t('aiHandedOff')}</Text>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => handOff(x)} style={[styles.handoff, { backgroundColor: c.fg }]}>
                      <Text style={{ color: c.bg, fontSize: 13, fontWeight: '800' }}>{t('aiHandoff')}</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ),
          )}
          <Text style={[styles.meta, { color: c.muted, textAlign: 'center', marginTop: space.s }]}>{t('aiDisclaimer')}</Text>
        </ScrollView>
        <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.bg }]}>
          {!draft ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
              {quick.map((q) => (
                <Pressable key={q} accessibilityRole="button" disabled={busy} onPress={() => ask(q)} style={[styles.quick, { borderColor: c.line }]}>
                  <Text style={{ color: c.fg, fontSize: 13 }}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.row}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('aiPlaceholder')}
              placeholderTextColor={c.muted}
              multiline
              maxLength={500}
              accessibilityLabel={t('aiPlaceholder')}
              style={[styles.input, { borderColor: c.line, color: c.fg }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('send')}
              disabled={!draft.trim() || busy}
              onPress={() => ask()}
              style={[styles.send, { backgroundColor: draft.trim() && !busy ? c.brand : c.pillOff }]}>
              <Text style={{ color: draft.trim() && !busy ? c.brandInk : c.muted, fontWeight: '800' }}>{t('aiAsk')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.l, paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth },
  feed: { padding: space.l, gap: space.s, width: '100%', maxWidth: 640, alignSelf: 'center' },
  bubble: { maxWidth: '86%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: radius.card, gap: 3, borderWidth: 1.5 },
  left: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  right: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  who: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 11.5, marginTop: 2 },
  handoff: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7, marginTop: 6 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: space.m, gap: space.s },
  row: { flexDirection: 'row', gap: space.s, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120, fontFamily: fontFamily('body', '400') },
  send: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 11 },
  quick: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
});
