// Vendors a curated set of brand marks from Simple Icons (CC0) into
// internal/web/static/icons/brands/*.svg and writes the name index the app
// imports. Run inside a node container; see the README.
//   docker run --rm -v "$PWD:/repo" -w /repo/tmp/brands node:22-alpine sh -c "npm i simple-icons && cp ../../scripts/gen-brand-icons.mjs gen.mjs && node gen.mjs"
import * as si from 'simple-icons';
import { mkdirSync, writeFileSync } from 'node:fs';

const slugs = ["apple","samsung","sony","lg","xiaomi","ikea","dell","hp","lenovo","asus","acer","huawei","nokia","motorola","oneplus","oppo","vivo","google","bosch","panasonic","toshiba","tplink","netgear","garmin","fitbit","jbl","bose","sennheiser","beats","sonos","roku","ring","epson","intel","amd","nvidia","razer","corsair","steelseries","seagate","nikon","fujifilm","leica","dji","insta360","audiotechnica","playstation","raspberrypi","arduino","3m","nike","adidas","puma","tata","havells","boat","amul","unilever","vim","tide","wipro","hitachi","jio","airtel","bata","bigbasket","swiggy","zomato","honda","suzuki","hyundai","kia","toyota","mahindra"];
const by = Object.fromEntries(Object.values(si).filter((x) => x && x.slug).map((x) => [x.slug, x]));

const root = '/repo/internal/web';
mkdirSync(`${root}/static/icons/brands`, { recursive: true });

let index = `// Product brand marks, for the things whose brand is the quickest way to
// recognise them: "the Sony one", "the IKEA one".
//
// The marks themselves are SVG files in /static/icons/brands/, vendored from
// Simple Icons (https://simpleicons.org, CC0 1.0, v${si.version || 'latest'}). They are
// filled glyphs, drawn through a CSS mask so they follow the text colour. Only
// this name index is bundled; the browser fetches a mark when one is shown.
//
// Brands are trademarks of their owners and appear here only to identify the
// owner's own belongings. Simple Icons has removed some brands at their
// owners' request (Philips, Canon, Microsoft, Nintendo and others); they are
// not here. Stored on an item as "brand:<key>".
// Regenerate with scripts/gen-brand-icons.mjs.

export const BRAND_ICONS = {\n`;
for (const s of slugs) {
  const i = by[s];
  if (!i) { console.error('missing', s); continue; }
  writeFileSync(`${root}/static/icons/brands/${s}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><title>${i.title}</title><path d="${i.path}"/></svg>\n`);
  index += `  ${JSON.stringify(s)}: ${JSON.stringify(i.title)},\n`;
}
index += `};\n\nexport const BRAND_KEYS = Object.keys(BRAND_ICONS);\n`;
writeFileSync(`${root}/static/js/brand-icons.js`, index);
console.log('wrote', slugs.length, 'brands');
