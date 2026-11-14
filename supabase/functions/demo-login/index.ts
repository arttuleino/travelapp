// Demo sign-in for sales demos ("Kokeile demoa" on the login page).
//
// POST { role: 'traveller' | 'guide', password? } -> { token_hash }
// The app exchanges token_hash for a session with supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
// No email is sent and no password is stored in the app.
//
// The demo accounts are members of the demo trip only (supabase/migrations/20261118090000_demo_trip.sql),
// so row level security keeps them away from real trips. The first demo sign-in of each day resets
// the demo trip to its start state.
//
// Optional secret DEMO_PASSWORD: when set, the demo opens only with that password.
// Deploy with JWT verification off (config.toml: [functions.demo-login] verify_jwt = false), because
// the person is not signed in yet.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ACCOUNTS = {
  traveller: 'demo.asiakas@groupglide.com',
  guide: 'demo.opas@groupglide.com',
} as const;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const body = (await req.json().catch(() => null)) as { role?: unknown; password?: unknown } | null;
  const role = body?.role === 'guide' ? 'guide' : body?.role === 'traveller' ? 'traveller' : null;
  if (!role) return json({ error: 'bad_request' }, 400);

  const required = Deno.env.get('DEMO_PASSWORD');
  if (required && body?.password !== required) return json({ error: 'password_required' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const reset = await admin.rpc('ensure_demo_trip');
  if (reset.error) return json({ error: 'demo_unavailable', detail: reset.error.message }, 500);

  const email = ACCOUNTS[role];
  // Creates the demo account the first time; afterwards this fails with "already registered", which is fine.
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return json({ error: 'demo_unavailable', detail: link.error?.message }, 500);

  return json({ token_hash: tokenHash });
});
