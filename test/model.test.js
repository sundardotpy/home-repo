// Derived model behavior tests.

import test from 'node:test';
import assert from 'node:assert/strict';

import { floorLabel, newLocation, newValue, parseDateUTC, photoURLs } from '../lib/model.js';

const NOW = new Date(Date.UTC(2026, 9, 11, 15, 30, 0)); // 2026-10-11

test('newValue', async (t) => {
  const cases = [
    { name: 'earphones', price: 1499, on: '2025-01-03', days: 646, perDay: 2.32 },
    { name: 'keyboard', price: 6499, on: '2025-08-20', days: 417, perDay: 15.59 },
    { name: 'bought today counts as one day', price: 450, on: '2026-10-11', days: 1, perDay: 450 },
    { name: 'future date is clamped', price: 100, on: '2027-01-01', days: 1, perDay: 100 },
    { name: 'free item', price: 0, on: '2025-01-03', days: 646, perDay: 0 },
  ];

  for (const c of cases) {
    await t.test(c.name, () => {
      const v = newValue(c.price, c.on, NOW);
      assert.notEqual(v, null, 'want a value');
      assert.equal(v.days, c.days);
      assert.equal(v.per_day, c.perDay);
    });
  }

  await t.test('no price', () => assert.equal(newValue(null, '2025-01-03', NOW), null));
  await t.test('no date', () => assert.equal(newValue(10, null, NOW), null));
  await t.test('bad date', () => assert.equal(newValue(10, '03/01/2025', NOW), null));
  await t.test('impossible date', () => assert.equal(newValue(10, '2025-02-30', NOW), null));
});

test('parseDateUTC rejects non-ISO and impossible calendar dates', () => {
  assert.equal(parseDateUTC('2025-01-03'), Date.UTC(2025, 0, 3));
  assert.equal(parseDateUTC('2025-13-01'), null);
  assert.equal(parseDateUTC('2025-1-3'), null);
  assert.equal(parseDateUTC('2025-02-30'), null);
  assert.equal(parseDateUTC(''), null);
  assert.equal(parseDateUTC(null), null);
});

test('floorLabel prefers an explicit name', () => {
  assert.equal(floorLabel(0, ''), 'Ground floor');
  assert.equal(floorLabel(-1, ''), 'Basement');
  assert.equal(floorLabel(-2, ''), 'Basement 2');
  assert.equal(floorLabel(1, ''), '1st floor');
  assert.equal(floorLabel(2, ''), '2nd floor');
  assert.equal(floorLabel(3, ''), '3rd floor');
  assert.equal(floorLabel(4, ''), '4th floor');
  assert.equal(floorLabel(11, ''), '11th floor');
  assert.equal(floorLabel(12, ''), '12th floor');
  assert.equal(floorLabel(13, ''), '13th floor');
  assert.equal(floorLabel(21, ''), '21st floor');
  assert.equal(floorLabel(0, '  Mezzanine  '), 'Mezzanine');
});

test('photoURLs', () => {
  assert.deepEqual(photoURLs('items/ab/id'), {
    full: '/media/items/ab/id.jpg',
    thumb: '/media/items/ab/id_t.jpg',
  });
  assert.deepEqual(photoURLs(null), { full: '', thumb: '' });
});

test('newLocation keeps the floor out of the path string', () => {
  const loc = newLocation('r1', 'Bedroom', 1, '', 'u1', ['Wardrobe', 'Top Shelf']);
  assert.deepEqual(loc.path, ['Bedroom', 'Wardrobe', 'Top Shelf']);
  assert.equal(loc.path_string, 'Bedroom > Wardrobe > Top Shelf');
  assert.equal(loc.floor_label, '1st floor');

  const loose = newLocation('r1', 'Hall', 0, '', null, []);
  assert.deepEqual(loose.path, ['Hall']);
  assert.equal(loose.storage_unit_id, null);
});
