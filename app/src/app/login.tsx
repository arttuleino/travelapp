import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LanguageChips } from '@/components/language-picker';
import { Body, Button, Card, Field, H1, Muted, Screen } from '@/components/ui';
import { DemoPasswordError, sendCode, signInDemo, signInSupabaseDemo, signInWithPassword, verifyCode } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { DEMO_LOGIN, DEMO_MODE, PASSWORD_LOGIN } from '@/lib/supabase';
import { space, usePalette } from '@/theme';

const FEATURES = ['feature1', 'feature2', 'feature3', 'feature4'] as const;

export default function Login() {
  const { t } = useI18n();
  const c = usePalette();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState<'traveller' | 'guide' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Kokeile demoa" on the real site: the password field appears only if the demo has one.
  const [demoPassword, setDemoPassword] = useState('');
  const [demoNeedsPassword, setDemoNeedsPassword] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submitEmail() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep('code');
    } catch {
      setError(t('sendCodeFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, code);
      // The root layout switches to the app once the session exists.
    } catch {
      setError(t('codeWrong'));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
    } catch {
      setError(t('passwordWrong'));
    } finally {
      setBusy(false);
    }
  }

  async function submitDemo(role: 'traveller' | 'guide') {
    setDemoBusy(role);
    setError(null);
    try {
      await signInDemo(password, role);
    } catch {
      setError(t('demoPasswordWrong'));
    } finally {
      setDemoBusy(null);
    }
  }

  async function openDemo(role: 'traveller' | 'guide') {
    setDemoBusy(role);
    setDemoError(null);
    try {
      await signInSupabaseDemo(role, demoPassword || undefined);
      // The root layout switches to the app once the session exists.
    } catch (e) {
      if (e instanceof DemoPasswordError) {
        setDemoError(demoNeedsPassword ? t('demoPasswordWrong') : null);
        setDemoNeedsPassword(true);
      } else {
        setDemoError(t('demoUnavailable'));
      }
    } finally {
      setDemoBusy(null);
    }
  }

  function backToEmail() {
    setStep('email');
    setCode('');
    setPassword('');
    setError(null);
  }

  return (
    <Screen>
      <LanguageChips />
      <Card tone="brand" style={{ gap: space.m, paddingVertical: space.xl }}>
        <H1 style={{ color: '#1A1A14' }}>{t('appName')}</H1>
        <View style={{ gap: space.s }}>
          {FEATURES.map((f) => (
            <Body key={f} style={{ color: '#1A1A14' }}>
              ✓ {t(f)}
            </Body>
          ))}
        </View>
      </Card>

      {DEMO_MODE ? (
        <View style={styles.form}>
          <Field
            label={t('demoPassword')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('pastePassword')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => password && submitDemo('traveller')}
            error={error}
          />
          <Muted>{t('demoHint')}</Muted>
          <View style={styles.buttons}>
            <Button label={t('asCustomer')} onPress={() => submitDemo('traveller')} disabled={!password || !!demoBusy} busy={demoBusy === 'traveller'} />
            <Button label={t('asGuide')} variant="ghost" onPress={() => submitDemo('guide')} disabled={!password || !!demoBusy} busy={demoBusy === 'guide'} />
          </View>
        </View>
      ) : step === 'email' ? (
        <View style={styles.form}>
          <Field
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => validEmail && submitEmail()}
            error={error}
          />
          <Muted>{t('emailHint')}</Muted>
          <Button label={t('sendCode')} onPress={submitEmail} disabled={!validEmail} busy={busy} style={{ alignSelf: 'flex-start' }} />
          {PASSWORD_LOGIN ? (
            <Button
              label={t('testPasswordLogin')}
              variant="ghost"
              small
              onPress={() => {
                setStep('password');
                setError(null);
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
          {DEMO_LOGIN ? (
            <Card style={{ gap: space.m, marginTop: space.l }}>
              <Body style={{ fontWeight: '700' }}>{t('tryDemo')}</Body>
              <Muted>{t('tryDemoHint')}</Muted>
              {demoNeedsPassword ? (
                <Field
                  label={t('demoPassword')}
                  value={demoPassword}
                  onChangeText={setDemoPassword}
                  placeholder={t('pastePassword')}
                  secureTextEntry
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={() => demoPassword && openDemo('traveller')}
                  error={demoError}
                />
              ) : demoError ? (
                <Muted style={{ color: c.live }}>{demoError}</Muted>
              ) : null}
              <View style={styles.buttons}>
                <Button label={t('asCustomer')} onPress={() => openDemo('traveller')} disabled={!!demoBusy || (demoNeedsPassword && !demoPassword)} busy={demoBusy === 'traveller'} />
                <Button label={t('asGuide')} variant="ghost" onPress={() => openDemo('guide')} disabled={!!demoBusy || (demoNeedsPassword && !demoPassword)} busy={demoBusy === 'guide'} />
              </View>
            </Card>
          ) : null}
        </View>
      ) : step === 'password' ? (
        <View style={styles.form}>
          <Field
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label={t('password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => validEmail && password && submitPassword()}
            error={error}
          />
          <View style={styles.buttons}>
            <Button label={t('signIn')} onPress={submitPassword} disabled={!validEmail || !password} busy={busy} />
            <Button label={t('back')} variant="ghost" onPress={backToEmail} />
          </View>
        </View>
      ) : (
        <View style={styles.form}>
          <Body>
            {t('codeSentTo')} <Body style={{ fontWeight: '700' }}>{email.trim().toLowerCase()}</Body>.
          </Body>
          <Field
            label={t('code')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            error={error}
          />
          <View style={styles.buttons}>
            <Button label={t('signIn')} onPress={submitCode} disabled={code.length !== 6} busy={busy} />
            <Button label={t('changeAddress')} variant="ghost" onPress={backToEmail} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.m },
  buttons: { flexDirection: 'row', gap: space.s, flexWrap: 'wrap' },
});
