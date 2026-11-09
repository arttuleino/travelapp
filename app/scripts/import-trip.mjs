#!/usr/bin/env node
// Imports one trip from three CSV files exported from the booking system:
//   trip.csv       external_ref,name,destination,country,starts_on,ends_on,timezone,hotel_name
//   members.csv    email,role,display_name,booking_ref,party_size,room,phone[,market FI|SE|NO]
//   programme.csv  day,starts_at,title,details
//
// Usage (from app/):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-trip.mjs --operator demo --dir scripts/example-trip [--replace-programme] [--dry-run]
//
// Trips and members are upserted, so re-running with an updated member list is safe.
// The programme is only written when the trip has none yet, so a re-import never
// overwrites a guide's changes. --replace-programme deletes and rewrites it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

import { parseCsv, validateTrip } from './csv.mjs';

const { values: args } = parseArgs({
  options: {
    operator: { type: 'string' },
    dir: { type: 'string' },
    'replace-programme': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});
if (!args.operator || !args.dir) {
  console.error('Käyttö: node scripts/import-trip.mjs --operator <slug> --dir <kansio> [--replace-programme] [--dry-run]');
  process.exit(2);
}

const read = (name) => parseCsv(readFileSync(join(args.dir, name), 'utf8'));
const { trip, members, programme, errors } = validateTrip(read('trip.csv'), read('members.csv'), read('programme.csv'));
if (errors.length) {
  console.error(`Tuonti keskeytetty, ${errors.length} virhettä:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`OK: ${trip.name} (${trip.starts_on}–${trip.ends_on}), ${members.length} henkilöä, ${programme.length} ohjelmakohtaa.`);
if (args['dry-run']) process.exit(0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Aseta SUPABASE_URL ja SUPABASE_SERVICE_ROLE_KEY. Palveluavainta ei koskaan laiteta sovellukseen.');
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const must = ({ data, error }, what) => {
  if (error) {
    console.error(`${what} epäonnistui: ${error.message}`);
    process.exit(1);
  }
  return data;
};

const operator = must(await db.from('operators').select('id').eq('slug', args.operator).maybeSingle(), 'Matkanjärjestäjän haku');
if (!operator) {
  console.error(`Matkanjärjestäjää "${args.operator}" ei löytynyt.`);
  process.exit(1);
}
const saved = must(
  await db.from('trips').upsert({ ...trip, operator_id: operator.id }, { onConflict: 'operator_id,external_ref' }).select('id').single(),
  'Matkan tallennus',
);
must(
  await db.from('trip_members').upsert(members.map((m) => ({ ...m, trip_id: saved.id })), { onConflict: 'trip_id,email' }),
  'Henkilöiden tallennus',
);

const { count } = await db.from('programme_items').select('id', { count: 'exact', head: true }).eq('trip_id', saved.id);
if (count && !args['replace-programme']) {
  console.log(`Ohjelmaa ei muutettu: matkalla on jo ${count} ohjelmakohtaa (käytä --replace-programme korvataksesi).`);
} else {
  if (count) must(await db.from('programme_items').delete().eq('trip_id', saved.id), 'Vanhan ohjelman poisto');
  must(await db.from('programme_items').insert(programme.map((p) => ({ ...p, trip_id: saved.id }))), 'Ohjelman tallennus');
  console.log(`Ohjelma tallennettu (${programme.length} kohtaa).`);
}
console.log(`Valmis. Matkan tunniste: ${saved.id}`);
