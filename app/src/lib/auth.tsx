import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { unregisterPush } from './push';
import { supabase } from './supabase';

type AuthState = { session: Session | null; ready: boolean };
const AuthContext = createContext<AuthState>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, ready: true }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Step 1: email the person a 6-digit code. Works for any address; access is decided by trip membership. */
export async function sendCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
  if (error) throw error;
}

/** Step 2: exchange the code for a session. */
export async function verifyCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

/** Test accounts only: sign in with a password set in the Supabase dashboard. */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

/** Demo mode (DanBot demo API): one shared password opens the sample trip as a traveller or the guide. */
export const DEMO_ACCOUNTS = { traveller: 'traveller@example.com', guide: 'guide@example.com' } as const;

export async function signInDemo(password: string, role: keyof typeof DEMO_ACCOUNTS) {
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_ACCOUNTS[role], password });
  if (error) throw error;
}

/** Thrown by signInSupabaseDemo when the demo-login function has a DEMO_PASSWORD set. */
export class DemoPasswordError extends Error {}

/**
 * "Kokeile demoa": the demo-login edge function prepares the demo trip and returns a one-time
 * sign-in token for the demo traveller or guide, which is exchanged here for a normal session.
 */
export async function signInSupabaseDemo(role: 'traveller' | 'guide', password?: string) {
  const { data, error } = await supabase.functions.invoke<{ token_hash?: string }>('demo-login', {
    body: { role, ...(password ? { password } : {}) },
  });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 401) throw new DemoPasswordError('password_required');
    throw error;
  }
  if (!data?.token_hash) throw new Error('demo_unavailable');
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
  if (verifyError) throw verifyError;
}

export async function signOut() {
  await unregisterPush().catch(() => {});
  await supabase.auth.signOut();
}
