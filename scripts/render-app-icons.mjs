import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
const dir = '/repo/internal/web/static/brand/';
const out = (src, name, size) => {
  const png = new Resvg(readFileSync(dir + src), { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(dir + name, png);
  console.log(name, png.length);
};
out('app-icon.svg', 'icon-192.png', 192);
out('app-icon.svg', 'icon-512.png', 512);
out('app-icon.svg', 'apple-touch-icon.png', 180);
out('app-icon-maskable.svg', 'icon-maskable-512.png', 512);
