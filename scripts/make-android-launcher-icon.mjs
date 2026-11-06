// Turns the app's macOS icon artwork into Android launcher assets.
//
//   node scripts/make-android-launcher-icon.mjs <source.png>
//
// The source is the 1024x1024 artwork behind the shipped .icns (a light
// rounded tile with a list: orange dot + grey pill, blue pill, green dot).
// Android wants three things from it:
//
//   - mipmap-<density>/ic_launcher.png           legacy bitmap icon
//   - mipmap-<density>/ic_launcher_foreground.png  adaptive foreground layer
//   - mipmap-<density>/ic_launcher_monochrome.png  themed-icon layer
//
// The adaptive foreground sits at 72/108 of the layer, the area every
// launcher mask shows, so the artwork keeps its own proportions instead of
// being clipped by the launcher's shape. The background layer is a flat
// colour that matches the tile, so a circle mask shows no transparent corner.
//
// Run from the repo root. The generated files are committed.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(root, 'android/app/src/main/res');

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/make-android-launcher-icon.mjs <source.png>');
  process.exit(1);
}

// Launcher density buckets: legacy icon edge in px, adaptive layer in px
// (the layer is 108dp, the visible mask the middle 72dp of it).
const DENSITIES = [
  { dir: 'mdpi', legacy: 48, layer: 108 },
  { dir: 'hdpi', legacy: 72, layer: 162 },
  { dir: 'xhdpi', legacy: 96, layer: 216 },
  { dir: 'xxhdpi', legacy: 144, layer: 324 },
  { dir: 'xxxhdpi', legacy: 192, layer: 432 },
];

// The tile colour, sampled from the artwork, and the flat background colour
// that has to match it exactly.
const TILE = [239, 238, 238];

// ---------------------------------------------------------------- source art

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const at = (x, y) => {
  const i = (y * W + x) * C;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

// The artwork's own bounding box, then a square crop centred on it so the
// tile stays centred when it is scaled.
let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y)[3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
const side = Math.max(maxX - minX + 1, maxY - minY + 1);
const left = Math.round((minX + maxX + 1) / 2 - side / 2);
const top = Math.round((minY + maxY + 1) / 2 - side / 2);
const crop = { left, top, width: side, height: side };
console.log(`artwork ${W}x${H}, box ${minX},${minY}-${maxX},${maxY}, crop ${crop.left},${crop.top} ${side}x${side}`);

const tile = await sharp(source).extract(crop).png().toBuffer();

// ------------------------------------------------------------- monochrome art

// The themed-icon layer: the same shapes, one ink. The tile itself drops
// out, the four list shapes stay.
const raw = await sharp(tile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const mono = Buffer.alloc(raw.info.width * raw.info.height * 4);
for (let i = 0; i < raw.info.width * raw.info.height; i++) {
  const r = raw.data[i * 4], g = raw.data[i * 4 + 1], b = raw.data[i * 4 + 2], a = raw.data[i * 4 + 3];
  let alpha = 0;
  if (a > 8) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min > 25) {
      // A coloured shape: keep the source coverage so the edge stays smooth.
      alpha = a;
    } else {
      // A grey shape (the pill): it is darker than the tile, so turn the
      // difference from the tile into coverage.
      const lum = (r + g + b) / 3;
      const tileLum = (TILE[0] + TILE[1] + TILE[2]) / 3;
      const gap = tileLum - lum;
      alpha = a > 250 ? Math.min(1, Math.max(0, gap / 40)) * 255 : 0;
    }
  }
  mono[i * 4] = 0;
  mono[i * 4 + 1] = 0;
  mono[i * 4 + 2] = 0;
  mono[i * 4 + 3] = Math.round(alpha);
}
const monoTile = await sharp(mono, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
  .png()
  .toBuffer();

// ------------------------------------------------------------------- outputs

for (const { dir, legacy, layer } of DENSITIES) {
  const out = join(RES, `mipmap-${dir}`);
  await mkdir(out, { recursive: true });

  // Legacy icon: the tile fills its square, rounded corners and all.
  await sharp(tile).resize(legacy, legacy, { fit: 'fill' }).png().toFile(join(out, 'ic_launcher.png'));

  // Adaptive layers: the artwork sits in the middle 72/108 of the layer,
  // which is what a launcher mask shows.
  const inset = Math.round((layer * 72) / 108);
  const place = async (art) =>
    sharp({
      create: { width: layer, height: layer, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp(art).resize(inset, inset, { fit: 'fill' }).png().toBuffer(),
          left: Math.round((layer - inset) / 2),
          top: Math.round((layer - inset) / 2),
        },
      ])
      .png()
      .toBuffer();

  await writeFile(join(out, 'ic_launcher_foreground.png'), await place(tile));
  await writeFile(join(out, 'ic_launcher_monochrome.png'), await place(monoTile));

  console.log(`mipmap-${dir}: ic_launcher ${legacy}px, layers ${layer}px (art ${inset}px)`);
}

// A preview of what a launcher shows, for eyeballing the result.
const preview = [];
for (const mask of ['circle', 'squircle']) {
  const layer = 432;
  const inset = Math.round((layer * 72) / 108);
  const base = await sharp({
    create: { width: layer, height: layer, channels: 4, background: { r: TILE[0], g: TILE[1], b: TILE[2], alpha: 1 } },
  })
    .composite([
      {
        input: await sharp(tile).resize(inset, inset, { fit: 'fill' }).png().toBuffer(),
        left: Math.round((layer - inset) / 2),
        top: Math.round((layer - inset) / 2),
      },
    ])
    .png()
    .toBuffer();
  const shape = Buffer.from(
    mask === 'circle'
      ? `<svg width="${layer}" height="${layer}"><circle cx="${layer / 2}" cy="${layer / 2}" r="${layer / 2}" fill="#fff"/></svg>`
      : `<svg width="${layer}" height="${layer}"><rect x="0" y="0" width="${layer}" height="${layer}" rx="${layer * 0.22}" fill="#fff"/></svg>`,
  );
  const maskBuf = await sharp(shape).png().toBuffer();
  preview.push({
    input: await sharp(base).composite([{ input: maskBuf, blend: 'dest-in' }]).png().toBuffer(),
    left: preview.length * (layer + 24),
    top: 0,
  });
}
await sharp({
  create: { width: preview.length * (432 + 24) + 24, height: 456, channels: 4, background: { r: 245, g: 247, b: 246, alpha: 1 } },
})
  .composite(preview)
  .png()
  .toFile('/tmp/iconwork/preview.png');
console.log('preview: /tmp/iconwork/preview.png');
