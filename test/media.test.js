// Photo processing and storage tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

import { DiskStore } from '../lib/media/diskstore.js';
import { MAX_UPLOAD, newKey, process, variantFromPath } from '../lib/media/index.js';

/** A recognisable test image: red ramps with x, green with y. */
function gradient(w, h) {
  const channels = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      channels[i] = Math.round((255 * x) / w);
      channels[i + 1] = Math.round((255 * y) / h);
      channels[i + 2] = 40;
    }
  }
  return sharp(channels, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Splices a minimal EXIF APP1 segment carrying only the orientation tag
 * directly after the JPEG's SOI marker.
 */
function withOrientation(jpg, orientation) {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0);
  tiff.writeUInt16LE(0x002a, 2);        // magic
  tiff.writeUInt32LE(8, 4);             // IFD0 offset
  tiff.writeUInt16LE(1, 8);             // one entry
  tiff.writeUInt16LE(0x0112, 10);       // Orientation
  tiff.writeUInt16LE(3, 12);            // SHORT
  tiff.writeUInt32LE(1, 14);            // count
  tiff.writeUInt16LE(orientation, 18);  // the value
  tiff.writeUInt32LE(0, 22);            // no next IFD

  const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = 0xe1; // APP1
  header.writeUInt16BE(payload.length + 2, 2);

  return Buffer.concat([jpg.subarray(0, 2), header, payload, jpg.subarray(2)]);
}

async function dimsOf(path) {
  const { width, height } = await sharp(path).metadata();
  return { width, height };
}

async function tmpStore() {
  const dir = await mkdtemp(join(tmpdir(), 'hr-media-'));
  return { store: await new DiskStore(dir).init(), dir };
}

test('resizes to both sizes without upscaling', async () => {
  const big = await gradient(2400, 1200);
  const out = await process(big);

  assert.equal(out.display.width, 1600);
  assert.equal(out.display.height, 800);
  assert.equal(out.thumb.width, 400);
  assert.equal(out.thumb.height, 200);
  assert.ok(out.display.bytes.length > 0);

  // Already small: left alone rather than blown up.
  const small = await process(await gradient(300, 200));
  assert.equal(small.display.width, 300);
  assert.equal(small.display.height, 200);
});

test('a sideways photo comes out upright', async () => {
  // Re-encoding drops the EXIF flag browsers would otherwise honour, so the
  // rotation has to be baked into the pixels.
  const rotated = withOrientation(await gradient(1200, 600), 6);
  const out = await process(rotated);
  assert.ok(out.display.height > out.display.width,
    `orientation 6 should give a portrait image, got ${out.display.width}x${out.display.height}`);

  for (const o of [1, 3, 8]) {
    const out2 = await process(withOrientation(await gradient(600, 1200), o));
    assert.ok(out2.display.width > 0);
  }
});

test('rejects junk and oversized uploads', async () => {
  await assert.rejects(() => process(Buffer.from('this is not an image')),
    (err) => err.kind === 'unsupported image format');
  await assert.rejects(() => process(Buffer.alloc(MAX_UPLOAD + 1)),
    (err) => err.kind === 'image too large');
  await assert.rejects(() => process(Buffer.alloc(0)),
    (err) => err.kind === 'unsupported image format');
});

test('PNG and WebP are accepted', async () => {
  const png = await sharp({
    create: { width: 900, height: 600, channels: 3, background: '#3355ff' },
  }).png().toBuffer();
  const out = await process(png);
  assert.equal(out.display.width, 900);

  const webp = await sharp({
    create: { width: 900, height: 600, channels: 3, background: '#3355ff' },
  }).webp().toBuffer();
  assert.equal((await process(webp)).display.width, 900);
});

test('save writes both files, delete removes both', async () => {
  const { store, dir } = await tmpStore();
  try {
    const key = await store.save(await gradient(800, 800));

    assert.deepEqual(await dimsOf(join(dir, `${key}.jpg`)), { width: 800, height: 800 });
    assert.deepEqual(await dimsOf(join(dir, `${key}_t.jpg`)), { width: 400, height: 400 });

    // Both are readable back through the store.
    assert.ok((await store.open(key, 'display')).length > 0);
    assert.ok((await store.open(key, 'thumb')).length > 0);

    await store.delete(key);
    for (const suffix of ['.jpg', '_t.jpg']) {
      await assert.rejects(() => stat(join(dir, key + suffix)), 'file should be gone');
    }
    // Deleting again is a no-op, not an error.
    await store.delete(key);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('opening a missing photo is a not-found, not a crash', async () => {
  const { store, dir } = await tmpStore();
  try {
    await assert.rejects(() => store.open('items/zz/nope', 'display'),
      (err) => err.kind === 'photo not found');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('newKey is unique and UUID-shaped', () => {
  const a = newKey();
  const b = newKey();
  assert.notEqual(a, b);
  assert.match(a, /^items\/[0-9a-f]{2}\/[0-9a-f-]{36}$/);
});

test('variantFromPath', () => {
  assert.deepEqual(variantFromPath('items/ab/id_t.jpg'), { key: 'items/ab/id', variant: 'thumb' });
  assert.deepEqual(variantFromPath('items/ab/id.jpg'), { key: 'items/ab/id', variant: 'display' });
  assert.equal(variantFromPath('items/ab/id.png').ok, false);
  assert.equal(variantFromPath('.jpg').ok, false);
});
