import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '@/lib/i18n';
import type { Announcement, Message } from '@/lib/types';
import { clockTime, dayLabel, type FeedItem } from '@/lib/unread';
import { radius, space, usePalette } from '@/theme';

type Props = {
  header: ReactNode;
  feed: FeedItem<Message, Announcement>[];
  me: string;
  timeZone: string;
  today: string;
  onSend: (body: string) => Promise<void>;
  placeholder: string;
  empty: string;
  /** Suggested messages shown above the input while it is empty. */
  quickReplies?: string[];
};

export function ChatView({ header, feed, me, timeZone, today, onSend, placeholder, empty, quickReplies }: Props) {
  const c = usePalette();
  const { t, locale } = useI18n();
  const scroll = useRef<ScrollViewInstance>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text = draft) {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setDraft('');
    } catch {
      setError(t('sendFailed'));
    } finally {
      setSending(false);
    }
  }

  const words = { today: t('today'), yesterday: t('yesterday'), tomorrow: t('tomorrow') };
  const labels = feed.map((f) => dayLabel(f.at, today, timeZone, words, locale));
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: c.line }]}>{header}</View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.feed}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled">
          {feed.length === 0 ? <Text style={{ color: c.muted, textAlign: 'center', marginTop: space.xl }}>{empty}</Text> : null}
          {feed.map((f, i) => {
            const label = labels[i];
            const sep = label !== labels[i - 1] ? <Text style={[styles.day, { color: c.muted }]}>{label.toUpperCase()}</Text> : null;
            if (f.kind === 'announcement') {
              const a = f.item;
              return (
                <View key={`a${a.id}`} style={{ gap: space.s }}>
                  {sep}
                  <View style={[styles.bubble, styles.left, { backgroundColor: c.cream }]}>
                    <Text style={[styles.who, { color: c.fg }]}>{a.title} · {t('toWholeGroup')}</Text>
                    <Text style={{ color: c.fg, fontSize: 15 }}>{a.body}</Text>
                    <Text style={[styles.time, { color: c.muted }]}>
                      {a.author_name ? `${a.author_name} · ` : ''}
                      {clockTime(a.send_at, timeZone)}
                      {a.edited_at ? ` · ${t('edited')}` : ''}
                    </Text>
                  </View>
                </View>
              );
            }
            const m = f.item;
            const mine = m.sender_id === me;
            return (
              <View key={m.id} style={{ gap: space.s }}>
                {sep}
                <View style={[styles.bubble, mine ? styles.right : styles.left, { backgroundColor: mine ? c.brand : c.card }]}>
                  {!mine ? <Text style={[styles.who, { color: c.fg }]}>{m.sender_name}</Text> : null}
                  <Text style={{ color: mine ? c.brandInk : c.fg, fontSize: 15 }}>{m.body}</Text>
                  <Text style={[styles.time, { color: mine ? c.brandInk : c.muted }]}>{clockTime(m.created_at, timeZone)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.composer, { borderTopColor: c.line, backgroundColor: c.bg }]}>
          {quickReplies?.length && !draft ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
              {quickReplies.map((q) => (
                <Pressable key={q} accessibilityRole="button" onPress={() => send(q)} style={[styles.quick, { borderColor: c.line }]}>
                  <Text style={{ color: c.fg, fontSize: 13 }}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {error ? <Text style={{ color: c.live, fontSize: 13 }}>{error}</Text> : null}
          <View style={styles.row}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={c.muted}
              multiline
              maxLength={2000}
              accessibilityLabel={t('message')}
              style={[styles.input, { borderColor: c.line, color: c.fg }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('send')}
              disabled={!draft.trim() || sending}
              onPress={() => send()}
              style={[styles.send, { backgroundColor: draft.trim() && !sending ? c.brand : c.pillOff }]}>
              <Text style={{ color: draft.trim() && !sending ? c.brandInk : c.muted, fontWeight: '800' }}>{t('send')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.l, paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth },
  feed: { padding: space.l, gap: space.s, width: '100%', maxWidth: 640, alignSelf: 'center' },
  day: { alignSelf: 'center', fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, paddingVertical: 6 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: radius.card, gap: 2 },
  left: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  right: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  who: { fontSize: 12, fontWeight: '700' },
  time: { fontSize: 11, opacity: 0.75, marginTop: 2 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: space.m, gap: space.s },
  row: { flexDirection: 'row', gap: space.s, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  send: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 11 },
  quick: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
});
