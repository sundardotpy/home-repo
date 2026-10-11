// Writes every line icon in the app as a standalone SVG file under
// internal/web/static/icons/home/, for design tools or anywhere the in-app
// registry is not available. The JS registry stays the source of truth; these
// files are generated from it.
//
//   docker run --rm -v "$PWD:/repo" -w /repo node:22-alpine \
//     node --experimental-default-type=module scripts/export-icons.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { ITEM_ICONS } from '../internal/web/static/js/item-icons.js';

const dir = new URL('../internal/web/static/icons/home/', import.meta.url);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

for (const [key, def] of Object.entries(ITEM_ICONS)) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><title>${def.label}</title>${def.path}</svg>\n`;
  writeFileSync(new URL(`${key}.svg`, dir), svg);
}
console.log(`wrote ${Object.keys(ITEM_ICONS).length} icons`);
