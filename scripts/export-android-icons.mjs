// Exports the web app's icon assets to Android:
//   - item line icons (item-icons.js + icon-set.js)  -> res/drawable/ic_item_*.xml
//   - brand marks (static/icons/brands/*.svg)        -> res/drawable/ic_brand_*.xml
//   - a generated ItemIcons.kt with key -> R.drawable maps and brand labels
//
// Run from the repo root:  node scripts/export-android-icons.mjs
// Re-run after adding icons; the generated files are committed.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_RES = join(root, 'android/app/src/main/res/drawable');
const OUT_KT = join(root, 'android/app/src/main/java/app/homerepo/ItemIcons.kt');

const { ITEM_ICONS, ICON_KEYS } = await import(
  `file://${join(root, 'internal/web/static/js/item-icons.js')}`
);
const { BRAND_ICONS } = await import(
  `file://${join(root, 'internal/web/static/js/brand-icons.js')}`
);
const { MONOGRAMS } = await import(
  `file://${join(root, 'internal/web/static/js/brand-monograms.js')}`
);

// ------------------------------------------------------------ svg -> vector

const num = (s) => parseFloat(s);
const f = (n) => String(Math.round(n * 1000) / 1000);

function circleToPath(a) {
  const cx = num(a.cx), cy = num(a.cy), r = num(a.r);
  return `M ${f(cx - r)} ${f(cy)} a ${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
}

function ellipseToPath(a) {
  const cx = num(a.cx), cy = num(a.cy), rx = num(a.rx), ry = num(a.ry);
  return `M ${f(cx - rx)} ${f(cy)} a ${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0 a ${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
}

function rectToPath(a) {
  const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
  const r = Math.min(num(a.rx ?? 0), w / 2, h / 2);
  if (r <= 0) return `M ${f(x)} ${f(y)} h ${f(w)} v ${f(h)} h ${f(-w)} Z`;
  return [
    `M ${f(x + r)} ${f(y)}`,
    `H ${f(x + w - r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}`,
    `V ${f(y + h - r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}`,
    `H ${f(x + r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}`,
    `V ${f(y + r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}`,
    'Z',
  ].join(' ');
}

/** Converts one stroke icon's markup into VectorDrawable path elements. */
function strokePaths(markup) {
  const out = [];
  for (const m of markup.matchAll(/<path\s+d="([^"]+)"[^/]*\/>/g)) {
    out.push(`  <path\n      android:pathData="${m[1]}"\n      android:strokeColor="#1D1B26"\n      android:strokeWidth="1.7"\n      android:strokeLineCap="round"\n      android:strokeLineJoin="round"\n      android:fillColor="#00000000"/>`);
  }
  for (const m of markup.matchAll(/<circle\s+([^/]*?)\/>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    out.push(`  <path\n      android:pathData="${circleToPath(a)}"\n      android:strokeColor="#1D1B26"\n      android:strokeWidth="1.7"\n      android:strokeLineCap="round"\n      android:fillColor="#00000000"/>`);
  }
  for (const m of markup.matchAll(/<ellipse\s+([^/]*?)\/>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    out.push(`  <path\n      android:pathData="${ellipseToPath(a)}"\n      android:strokeColor="#1D1B26"\n      android:strokeWidth="1.7"\n      android:strokeLineCap="round"\n      android:fillColor="#00000000"/>`);
  }
  for (const m of markup.matchAll(/<rect\s+([^/]*?)\/>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    out.push(`  <path\n      android:pathData="${rectToPath(a)}"\n      android:strokeColor="#1D1B26"\n      android:strokeWidth="1.7"\n      android:strokeLineCap="round"\n      android:strokeLineJoin="round"\n      android:fillColor="#00000000"/>`);
  }
  return out;
}

const vector = (body) =>
  `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="24dp"\n    android:height="24dp"\n    android:viewportWidth="24"\n    android:viewportHeight="24">\n${body}\n</vector>\n`;

const safe = (s) => s.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');

// ------------------------------------------------------------------- items

await mkdir(OUT_RES, { recursive: true });
const itemMap = [];
let itemDone = 0;
for (const key of ICON_KEYS) {
  const def = ITEM_ICONS[key];
  if (!def?.path) continue;
  const paths = strokePaths(def.path);
  if (paths.length === 0) {
    console.warn(`  ! no paths for item icon "${key}"`);
    continue;
  }
  const res = `ic_item_${safe(key)}`;
  await writeFile(join(OUT_RES, `${res}.xml`), vector(paths.join('\n')));
  itemMap.push([key, res]);
  itemDone += 1;
}

// ------------------------------------------------------------------ brands

const brandDir = join(root, 'internal/web/static/icons/brands');
const brandMap = [];
for (const file of (await readdir(brandDir)).filter((f) => f.endsWith('.svg'))) {
  const slug = file.replace(/\.svg$/, '');
  const svg = await readFile(join(brandDir, file), 'utf8');
  const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (ds.length === 0) {
    console.warn(`  ! no paths in brand "${slug}"`);
    continue;
  }
  const body = ds
    .map((d) => `  <path\n      android:pathData="${d}"\n      android:fillColor="#1D1B26"/>`)
    .join('\n');
  const res = `ic_brand_${safe(slug)}`;
  await writeFile(join(OUT_RES, `${res}.xml`), vector(body));
  brandMap.push([slug, res]);
}

// ------------------------------------------------------------------- kotlin

const ktLabel = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const itemMapKt = itemMap
  .map(([k, r]) => `    "${ktLabel(k)}" to R.drawable.${r},`)
  .join('\n');
const brandMapKt = brandMap
  .map(([k, r]) => `    "${ktLabel(k)}" to R.drawable.${r},`)
  .join('\n');
const brandLabelsKt = Object.entries(BRAND_ICONS)
  .map(([k, v]) => `    "${ktLabel(k)}" to "${ktLabel(v)}",`)
  .join('\n');
const monogramsKt = Object.entries(MONOGRAMS)
  .map(([k, v]) => `    "${ktLabel(k)}" to Monogram("${ktLabel(v.mono)}", "${ktLabel(v.label)}"),`)
  .join('\n');

await writeFile(
  OUT_KT,
  `// Generated by scripts/export-android-icons.mjs — do not edit by hand.
// Maps the web app's icon keys (stored on items) to bundled VectorDrawables.

package app.homerepo

import app.homerepo.R

data class Monogram(val initials: String, val label: String)

object ItemIcons {
    /** Line icons, keyed exactly as the web app stores them on items. */
    val items: Map<String, Int> = mapOf(
${itemMapKt}
    )

    /** Brand marks, for keys of the form "brand:<slug>". */
    val brands: Map<String, Int> = mapOf(
${brandMapKt}
    )

    /** Display names for brand slugs. */
    val brandLabels: Map<String, String> = mapOf(
${brandLabelsKt}
    )

    /** Monogram fallbacks for brands whose logo has no licence-clean source. */
    val monograms: Map<String, Monogram> = mapOf(
${monogramsKt}
    )
}
`,
);

console.log(`icons: ${itemDone} item icons, ${brandMap.length} brand marks -> android/app/src/main/res/drawable`);
console.log(`map: ItemIcons.kt (${itemMap.length + brandMap.length} drawables, ${Object.keys(MONOGRAMS).length} monograms)`);
