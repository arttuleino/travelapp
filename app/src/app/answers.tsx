import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, Eyebrow, Field, H1, H2, Muted, Screen } from '@/components/ui';
import { deleteAnswer, saveAnswer, useAnswers, type Answer } from '@/lib/answers';
import { useI18n } from '@/lib/i18n';
import { useMembership } from '@/lib/trip';
import { space, usePalette } from '@/theme';

/** Guide: the answer bank. Travellers' AI guide answers from these, so common questions don't reach the guide. */
export default function AnswersScreen() {
  const { t } = useI18n();
  const { role, trip } = useMembership();
  const { rows, loading } = useAnswers(trip.id);
  const [editing, setEditing] = useState<Answer | 'new' | null>(null);
  if (role !== 'guide')
    return (
      <Screen>
        <Muted>{t('onlyGuideFinance')}</Muted>
      </Screen>
    );
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow>{t('aiGuide')}</Eyebrow>
        <H1>{t('answerBank')}</H1>
        <Muted>{t('answerBankHint')}</Muted>
      </View>
      {editing ? (
        <AnswerForm tripId={trip.id} initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <Button label={t('answerNew')} onPress={() => setEditing('new')} style={{ alignSelf: 'flex-start' }} />
      )}
      {!loading && rows.length === 0 ? <Muted>{t('answerBankEmpty')}</Muted> : null}
      {rows.map((a) => (
        <Card key={a.id} style={{ gap: 6 }}>
          <H2 style={{ fontSize: 17 }}>{a.question}</H2>
          <Body>{a.answer}</Body>
          <Button small variant="ghost" label={t('answerEdit')} onPress={() => setEditing(a)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ))}
      <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function AnswerForm({ tripId, initial, onDone }: { tripId: string; initial: Answer | null; onDone: () => void }) {
  const c = usePalette();
  const { t } = useI18n();
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch {
      setError(t('saveFailed'));
    } finally {
      setBusy(false);
    }
  }
  const save = () => {
    if (!question.trim() || !answer.trim()) return setError(t('answerMissing'));
    void run(() => saveAnswer(tripId, question, answer, initial?.id));
  };

  return (
    <Card tone="cream" style={{ gap: space.m }}>
      <H2>{initial ? t('answerEdit') : t('answerNew')}</H2>
      <Field label={t('answerQuestion')} value={question} onChangeText={setQuestion} maxLength={300} />
      <Field label={t('answerText')} value={answer} onChangeText={setAnswer} multiline maxLength={2000} style={{ minHeight: 110, textAlignVertical: 'top' }} />
      {error ? <Muted style={{ color: c.live }}>{error}</Muted> : null}
      <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
        <Button label={t('save')} busy={busy} onPress={save} />
        <Button label={t('cancel')} variant="ghost" onPress={onDone} />
        {initial ? <Button label={t('answerDelete')} variant="danger" disabled={busy} onPress={() => void run(() => deleteAnswer(initial.id))} /> : null}
      </View>
    </Card>
  );
}
