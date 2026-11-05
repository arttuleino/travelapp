import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Field, H1, Muted, Screen } from '@/components/ui';
import { sendCode, signInWithPassword, verifyCode } from '@/lib/auth';
import { PASSWORD_LOGIN } from '@/lib/supabase';
import { space } from '@/theme';

const FEATURES = [
  'Maksa matka, tee lisävarauksia ja muutoksia varaukseesi.',
  'Seuraa viikon ohjelmaa ja näe heti, jos aikataulu muuttuu.',
  'Näe tiedot lennoistasi, majoituksestasi ja matkakohteestasi.',
  'Keskustele oppaasi kanssa matkan aikana.',
];

export default function Login() {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submitEmail() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep('code');
    } catch {
      setError('Koodin lähettäminen ei onnistunut. Tarkista osoite ja yritä hetken päästä uudelleen.');
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
      setError('Koodi on väärä tai vanhentunut. Tarkista koodi tai pyydä uusi.');
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
      setError('Sähköposti tai salasana on väärä.');
    } finally {
      setBusy(false);
    }
  }

  function backToEmail() {
    setStep('email');
    setCode('');
    setPassword('');
    setError(null);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Card tone="brand" style={{ gap: space.m, paddingVertical: space.xl }}>
          <H1 style={{ color: '#1A1A14' }}>Minun matkani</H1>
          <View style={{ gap: space.s }}>
            {FEATURES.map((f) => (
              <Body key={f} style={{ color: '#1A1A14' }}>
                ✓ {f}
              </Body>
            ))}
          </View>
        </Card>

        {step === 'email' ? (
          <View style={styles.form}>
            <Field
              label="Sähköposti"
              value={email}
              onChangeText={setEmail}
              placeholder="sinä@esimerkki.fi"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={() => validEmail && submitEmail()}
              error={error}
            />
            <Muted>Käytä samaa sähköpostiosoitetta, jonka annoit varausta tehdessäsi. Lähetämme siihen kirjautumiskoodin.</Muted>
            <Button label="Lähetä koodi" onPress={submitEmail} disabled={!validEmail} busy={busy} style={{ alignSelf: 'flex-start' }} />
            {PASSWORD_LOGIN ? (
              <Button
                label="Testitunnus: kirjaudu salasanalla"
                variant="ghost"
                small
                onPress={() => {
                  setStep('password');
                  setError(null);
                }}
                style={{ alignSelf: 'flex-start' }}
              />
            ) : null}
          </View>
        ) : step === 'password' ? (
          <View style={styles.form}>
            <Field
              label="Sähköposti"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label="Salasana"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => validEmail && password && submitPassword()}
              error={error}
            />
            <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
              <Button label="Kirjaudu sisään" onPress={submitPassword} disabled={!validEmail || !password} busy={busy} />
              <Button label="Takaisin" variant="ghost" onPress={backToEmail} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Body>
              Lähetimme koodin osoitteeseen <Body style={{ fontWeight: '700' }}>{email.trim().toLowerCase()}</Body>.
            </Body>
            <Field
              label="Kirjautumiskoodi"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              error={error}
            />
            <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
              <Button label="Kirjaudu sisään" onPress={submitCode} disabled={code.length !== 6} busy={busy} />
              <Button label="Vaihda osoite" variant="ghost" onPress={backToEmail} />
            </View>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ form: { gap: space.m } });
