import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mapFor, normalizePlace, noteIn, placeFor } from './resort-map.ts';

test('mapFor finds the drawn map by destination name', () => {
  assert.equal(mapFor('Saalbach-Hinterglemm')?.id, 'saalbach-hinterglemm');
  assert.equal(mapFor('Hinterglemm')?.id, 'saalbach-hinterglemm');
  assert.equal(mapFor('Levi'), null);
  assert.equal(mapFor(null), null);
});

test('placeFor links the demo programme to places', () => {
  const map = mapFor('Saalbach-Hinterglemm')!;
  const at = (text: string) => placeFor(map, text, 'Hotel Bergkristall')?.id ?? null;
  assert.equal(at('Opastettu lasku: Zwölferkogel Kokoontuminen Zwölferkogelbahnin ala-asemalla'), 'zwolferkogelbahn');
  assert.equal(at('Tutustumislasku oppaan kanssa Kokoontuminen Schattberg X-pressin ala-asemalla'), 'schattberg');
  assert.equal(at('Lounas Rosswaldhütte Pöytä varattu ryhmälle'), 'rosswald');
  // The rental shop wins over "2 min hotellilta" because the hotel is checked last.
  assert.equal(at('Suksivuokraamon nouto Intersport Bründl, 2 min hotellilta'), 'brundl');
  assert.equal(at('Fondue-ilta Lisäpalvelu, nouto hotellilta 20:15'), 'hotel');
  assert.equal(at('Welcome drinks at Bergkristall'), 'hotel');
  assert.equal(at('Aamun lumikatsaus chatissa'), null);
  assert.equal(at('Lento Helsinki → Salzburg AY1661'), null);
});

test('keywords are stored normalized, and every place has a Finnish note', () => {
  for (const p of mapFor('Saalbach')!.places) {
    for (const k of p.keywords) assert.equal(k, normalizePlace(k), `${p.id}: ${k}`);
    if (p.kind !== 'hotel') assert.ok(p.note.fi.length > 0, p.id);
  }
});

test('noteIn falls back to Finnish', () => {
  const lift = mapFor('Saalbach')!.places.find((p) => p.id === 'schattberg')!;
  assert.equal(noteIn(lift, 'en'), 'Lift from the centre of Saalbach up to Schattberg.');
  assert.equal(noteIn(lift, 'xx'), lift.note.fi);
});
