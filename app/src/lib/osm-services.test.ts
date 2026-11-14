import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bboxAround, kindOf, overpassQuery, parseServices } from './osm-services.ts';

test('kindOf sorts OpenStreetMap objects into services', () => {
  assert.equal(kindOf({ amenity: 'restaurant', name: 'Rosswaldhütte' }), 'hut');
  assert.equal(kindOf({ tourism: 'alpine_hut', name: 'Spielberghaus' }), 'hut');
  assert.equal(kindOf({ amenity: 'cafe', name: 'Café Wolf' }), 'food');
  assert.equal(kindOf({ shop: 'ski', name: 'Bründl' }), 'rental');
  assert.equal(kindOf({ amenity: 'ski_school', name: 'Skischule Fuchs' }), 'school');
  assert.equal(kindOf({ amenity: 'pharmacy', name: 'Apotheke' }), 'health');
  assert.equal(kindOf({ amenity: 'atm', name: 'Raiffeisen' }), 'atm');
  assert.equal(kindOf({ highway: 'bus_stop', name: 'Saalbach Zentrum' }), 'bus');
  assert.equal(kindOf({ amenity: 'parking', name: 'P1' }), null);
});

test('parseServices keeps named services and skips ones already pinned', () => {
  const json = {
    elements: [
      { type: 'node', id: 1, lat: 47.391, lon: 12.636, tags: { amenity: 'restaurant', name: 'Zum Turm' } },
      { type: 'way', id: 2, center: { lat: 47.38, lon: 12.6 }, tags: { tourism: 'alpine_hut', name: 'Bergalm' } },
      { type: 'node', id: 3, lat: 47.39, lon: 12.63, tags: { amenity: 'restaurant' } },
      { type: 'node', id: 4, lat: 47.389387, lon: 12.56862, tags: { amenity: 'restaurant', name: 'Rosswaldhütte' } },
    ],
  };
  const out = parseServices(json, [{ lat: 47.389387, lng: 12.56862 }]);
  assert.deepEqual(
    out.map((s) => [s.id, s.kind, s.name]),
    [
      ['n1', 'food', 'Zum Turm'],
      ['w2', 'hut', 'Bergalm'],
    ],
  );
  assert.deepEqual(parseServices({}), []);
  const stops = parseServices({
    elements: [
      { type: 'node', id: 10, lat: 47.39, lon: 12.63, tags: { highway: 'bus_stop', name: 'Zentrum' } },
      { type: 'node', id: 11, lat: 47.3902, lon: 12.6301, tags: { highway: 'bus_stop', name: 'Zentrum' } },
      { type: 'node', id: 12, lat: 47.38, lon: 12.6, tags: { highway: 'bus_stop', name: 'Zentrum' } },
    ],
  });
  assert.deepEqual(stops.map((s) => s.id), ['n10', 'n12'], 'the other direction of the same stop is dropped');
});

test('bboxAround pads by about the given distance', () => {
  const b = bboxAround([{ lat: 47.38, lng: 12.6 }], 1000);
  assert.ok(Math.abs(b.north - b.south - 0.018) < 0.001);
  assert.ok(overpassQuery(b).includes(`(${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)})`));
});
