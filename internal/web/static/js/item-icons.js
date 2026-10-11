import { BRAND_ICONS } from './brand-icons.js';
import { EXTRA_ICONS } from './icon-set.js';

// Pre-built item icons, for the (many) things nobody wants to photograph.
//
// Each entry is a stroke-only 24×24 path plus the words that should suggest it.
// The key is what gets stored on the item, so these names are a stable API —
// rename one and existing items lose their icon.

const LEGACY_ICONS = {
  box: {
    label: 'Box',
    keywords: ['box', 'carton', 'crate', 'storage', 'container', 'misc'],
    path: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/>',
  },
  tools: {
    label: 'Tools',
    keywords: ['tool', 'toolbox', 'diy', 'repair', 'workshop'],
    path: '<path d="M15 4a5 5 0 00-4.6 7L4 17.4 6.6 20l6.4-6.4A5 5 0 1015 4z"/>',
  },
  drill: {
    label: 'Drill',
    keywords: ['drill', 'driver', 'power tool', 'cordless'],
    path: '<path d="M3 8h10v5H3z"/><path d="M13 10h5l3-2v6l-3-2h-5"/><path d="M6 13v6"/>',
  },
  hammer: {
    label: 'Hammer',
    keywords: ['hammer', 'mallet', 'nail'],
    path: '<path d="M14 3l7 7-3 3-7-7z"/><path d="M11 9l-8 8 3 3 8-8"/>',
  },
  screwdriver: {
    label: 'Screwdriver',
    keywords: ['screwdriver', 'screw', 'bit', 'hex'],
    path: '<path d="M4 20l4-1 9-9-3-3-9 9z"/><path d="M17 4l3 3"/>',
  },
  fasteners: {
    label: 'Screws & nails',
    keywords: ['screws', 'nails', 'bolts', 'nuts', 'washers', 'hardware'],
    path: '<path d="M10 3h4l-1 4h-2z"/><path d="M11 7h2l-1 13z"/><path d="M17 5h4M19 3v4"/>',
  },
  laptop: {
    label: 'Laptop',
    keywords: ['laptop', 'computer', 'macbook', 'notebook', 'pc'],
    path: '<path d="M5 6h14v9H5z"/><path d="M3 18h18"/>',
  },
  phone: {
    label: 'Phone',
    keywords: ['phone', 'mobile', 'iphone', 'android', 'tablet', 'ipad'],
    path: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  },
  camera: {
    label: 'Camera',
    keywords: ['camera', 'dslr', 'lens', 'photo', 'gopro'],
    path: '<path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.5"/>',
  },
  headphones: {
    label: 'Headphones',
    keywords: ['headphones', 'earphones', 'earbuds', 'airpods', 'audio'],
    path: '<path d="M4 14v-2a8 8 0 1116 0v2"/><rect x="2" y="14" width="4" height="6" rx="1"/><rect x="18" y="14" width="4" height="6" rx="1"/>',
  },
  tv: {
    label: 'TV & monitor',
    keywords: ['tv', 'television', 'monitor', 'screen', 'display'],
    path: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
  },
  cable: {
    label: 'Cables',
    keywords: ['cable', 'cord', 'wire', 'usb', 'hdmi', 'charger', 'lead'],
    path: '<path d="M5 5v4a4 4 0 004 4h6a4 4 0 014 4v3"/><circle cx="5" cy="3.5" r="1.5"/><circle cx="19" cy="20.5" r="1.5"/>',
  },
  battery: {
    label: 'Batteries',
    keywords: ['battery', 'batteries', 'aa', 'aaa', 'cell', 'power bank'],
    path: '<rect x="2" y="8" width="16" height="8" rx="2"/><path d="M20 11v2"/><path d="M6 12h6"/>',
  },
  plug: {
    label: 'Plugs & adapters',
    keywords: ['plug', 'adapter', 'socket', 'extension', 'power', 'electric'],
    path: '<path d="M9 3v6M15 3v6"/><path d="M6 9h12v3a6 6 0 01-12 0z"/><path d="M12 18v3"/>',
  },
  bulb: {
    label: 'Bulbs & lighting',
    keywords: ['bulb', 'lamp', 'light', 'lighting', 'led', 'torch'],
    path: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3 11v2h6v-2a6 6 0 00-3-11z"/>',
  },
  router: {
    label: 'Network gear',
    keywords: ['router', 'modem', 'wifi', 'network', 'switch', 'ethernet'],
    path: '<path d="M5 12a10 10 0 0114 0"/><path d="M8.5 15a5 5 0 017 0"/><circle cx="12" cy="18.5" r="1"/>',
  },
  shirt: {
    label: 'Clothes',
    keywords: ['shirt', 'clothes', 'clothing', 'tshirt', 'top', 'dress', 'trousers'],
    path: '<path d="M8 3l4 2 4-2 4 3-2 3-2-1v11H8V8L6 9 4 6z"/>',
  },
  jacket: {
    label: 'Coats & jackets',
    keywords: ['jacket', 'coat', 'winter', 'hoodie', 'raincoat'],
    path: '<path d="M8 3l4 3 4-3 4 3v14h-5V10h-6v10H5V6z"/>',
  },
  shoes: {
    label: 'Shoes',
    keywords: ['shoes', 'boots', 'trainers', 'sneakers', 'sandals'],
    path: '<path d="M3 16h9l3 2h6v2H3z"/><path d="M3 16V9h4l2 3 3 1"/>',
  },
  hat: {
    label: 'Hats',
    keywords: ['hat', 'cap', 'beanie', 'helmet'],
    path: '<path d="M6 12V7a6 6 0 0112 0v5"/><path d="M3 12h18v2a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  },
  bag: {
    label: 'Bags',
    keywords: ['bag', 'handbag', 'backpack', 'rucksack', 'tote'],
    path: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  },
  suitcase: {
    label: 'Luggage',
    keywords: ['suitcase', 'luggage', 'travel', 'trolley', 'case'],
    path: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M8 20v1M16 20v1"/>',
  },
  umbrella: {
    label: 'Umbrella',
    keywords: ['umbrella', 'parasol', 'rain'],
    path: '<path d="M12 3a9 9 0 019 9H3a9 9 0 019-9z"/><path d="M12 12v7a2 2 0 004 0"/>',
  },
  linen: {
    label: 'Bedding & linen',
    keywords: ['bedsheets', 'sheets', 'linen', 'duvet', 'pillow', 'blanket', 'towel', 'bedding'],
    path: '<path d="M3 18v-8a2 2 0 012-2h14a2 2 0 012 2v8"/><path d="M3 14h18"/><path d="M7 8V6h6v2"/>',
  },
  book: {
    label: 'Books',
    keywords: ['book', 'books', 'novel', 'manual', 'magazine'],
    path: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M8 4v13"/>',
  },
  documents: {
    label: 'Documents',
    keywords: ['document', 'documents', 'papers', 'passport', 'certificate', 'files', 'warranty'],
    path: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h6M10 16h4"/>',
  },
  stationery: {
    label: 'Stationery',
    keywords: ['pen', 'pencil', 'stationery', 'marker', 'notebook', 'office'],
    path: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  },
  key: {
    label: 'Keys',
    keywords: ['key', 'keys', 'spare key', 'lock', 'padlock'],
    path: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9l-2 3M17 12v3"/>',
  },
  wallet: {
    label: 'Wallet & cards',
    keywords: ['wallet', 'purse', 'card', 'cash', 'money'],
    path: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14" r="1"/>',
  },
  glasses: {
    label: 'Glasses',
    keywords: ['glasses', 'spectacles', 'sunglasses', 'reading glasses'],
    path: '<circle cx="6" cy="14" r="3"/><circle cx="18" cy="14" r="3"/><path d="M9 14h6M3 11l2-4M21 11l-2-4"/>',
  },
  watch: {
    label: 'Watches',
    keywords: ['watch', 'wristwatch', 'clock', 'smartwatch'],
    path: '<circle cx="12" cy="12" r="5"/><path d="M9 7l1-4h4l1 4M9 17l1 4h4l1-4"/>',
  },
  jewellery: {
    label: 'Jewellery',
    keywords: ['jewellery', 'jewelry', 'ring', 'necklace', 'earrings', 'gold'],
    path: '<circle cx="12" cy="15" r="5"/><path d="M9 8l3-4 3 4"/>',
  },
  mug: {
    label: 'Cups & mugs',
    keywords: ['mug', 'cup', 'glass', 'tea', 'coffee', 'crockery'],
    path: '<path d="M4 6h12v9a4 4 0 01-4 4H8a4 4 0 01-4-4z"/><path d="M16 9h2a3 3 0 010 6h-2"/>',
  },
  cookware: {
    label: 'Cookware',
    keywords: ['pot', 'pan', 'cookware', 'saucepan', 'kitchen', 'utensils'],
    path: '<path d="M4 9h14v6a4 4 0 01-4 4H8a4 4 0 01-4-4z"/><path d="M18 11h3"/><path d="M8 6l1-2M13 6l1-2"/>',
  },
  bottle: {
    label: 'Bottles',
    keywords: ['bottle', 'flask', 'water', 'thermos', 'drink'],
    path: '<path d="M10 3h4v3l2 3v12H8V9l2-3z"/><path d="M8 13h8"/>',
  },
  food: {
    label: 'Food & tins',
    keywords: ['food', 'tin', 'can', 'jar', 'pantry', 'groceries', 'spice'],
    path: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
  },
  medicine: {
    label: 'Medicine',
    keywords: ['medicine', 'first aid', 'pills', 'plasters', 'bandage', 'health', 'medical'],
    path: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M12 10v6M9 13h6"/><path d="M8 6V4h8v2"/>',
  },
  cleaning: {
    label: 'Cleaning',
    keywords: ['cleaning', 'detergent', 'spray', 'soap', 'bleach', 'laundry'],
    path: '<path d="M9 8h6v13H9z"/><path d="M11 8V5h4"/><path d="M17 5h3M17 8h2"/>',
  },
  paint: {
    label: 'Paint & decorating',
    keywords: ['paint', 'brush', 'roller', 'decorating', 'varnish'],
    path: '<path d="M4 5h14v5H4z"/><path d="M18 7h2v5l-6 3v6"/>',
  },
  garden: {
    label: 'Garden',
    keywords: ['garden', 'plant', 'seeds', 'pots', 'gardening', 'soil'],
    path: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  },
  sports: {
    label: 'Sports',
    keywords: ['ball', 'sports', 'football', 'gym', 'racket', 'yoga'],
    path: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  },
  bike: {
    label: 'Bike',
    keywords: ['bike', 'bicycle', 'cycling', 'helmet', 'pump'],
    path: '<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-8h5l3 8M9 9h4"/>',
  },
  camping: {
    label: 'Camping',
    keywords: ['tent', 'camping', 'sleeping bag', 'outdoor', 'hiking'],
    path: '<path d="M12 4L3 20h18z"/><path d="M12 10l-4 10M12 10l4 10"/>',
  },
  toys: {
    label: 'Toys',
    keywords: ['toy', 'toys', 'lego', 'games', 'puzzle', 'kids'],
    path: '<circle cx="9" cy="9" r="5"/><path d="M13 13l5 5"/><circle cx="19" cy="19" r="2"/>',
  },
  baby: {
    label: 'Baby',
    keywords: ['baby', 'nappies', 'pram', 'infant', 'bottle feeding'],
    path: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0114 0"/><path d="M10 7h.01M14 7h.01"/>',
  },
  pet: {
    label: 'Pet',
    keywords: ['pet', 'dog', 'cat', 'leash', 'animal'],
    path: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="9" r="2"/><path d="M12 12c-3 0-5 2-5 4.5S9 21 12 21s5-2 5-4.5S15 12 12 12z"/>',
  },
  music: {
    label: 'Music',
    keywords: ['music', 'guitar', 'instrument', 'records', 'vinyl', 'speaker'],
    path: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  },
  art: {
    label: 'Art & craft',
    keywords: ['art', 'craft', 'sewing', 'wool', 'canvas', 'paints', 'knitting'],
    path: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="8" r="1"/>',
  },
  gift: {
    label: 'Gifts & seasonal',
    keywords: ['gift', 'present', 'christmas', 'decorations', 'seasonal', 'wrapping'],
    path: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S9 3 7 5s5 3 5 3zM12 8s3-5 5-3-5 3-5 3z"/>',
  },
};

// Which picker section each original icon belongs to. The newer icons carry
// their own group.
const LEGACY_GROUPS = {
  Electronics: ['laptop', 'phone', 'camera', 'headphones', 'tv', 'router'],
  'Power & cables': ['cable', 'battery', 'plug', 'bulb'],
  Tools: ['tools', 'drill', 'hammer', 'screwdriver', 'fasteners', 'paint'],
  Clothing: ['shirt', 'jacket', 'shoes', 'hat', 'bag', 'umbrella', 'glasses', 'watch', 'jewellery', 'wallet'],
  'Vehicle & travel': ['suitcase', 'bike'],
  'Bedroom & furniture': ['linen'],
  'Documents & stationery': ['book', 'documents', 'stationery'],
  Kitchen: ['mug', 'cookware', 'bottle', 'food'],
  Cleaning: ['cleaning'],
  Health: ['medicine'],
  'Kids & toys': ['toys', 'baby'],
  'Sports & hobbies': ['sports', 'music', 'art'],
  'Garden & outdoor': ['garden', 'camping'],
  Pets: ['pet'],
  Decor: ['gift'],
  'Storage & misc': ['box', 'key'],
};

const groupOf = Object.fromEntries(
  Object.entries(LEGACY_GROUPS).flatMap(([group, keys]) => keys.map((k) => [k, group])),
);

export const ITEM_ICONS = {
  ...Object.fromEntries(
    Object.entries(LEGACY_ICONS).map(([k, v]) => [k, { group: groupOf[k] || 'Storage & misc', ...v }]),
  ),
  ...EXTRA_ICONS,
};

// Picker order. Anything with a group not listed here sorts last.
export const ICON_GROUPS = [
  'Electronics',
  'Power & cables',
  'Appliances',
  'Tools',
  'Kitchen',
  'Cleaning',
  'Bathroom',
  'Clothing',
  'Bedroom & furniture',
  'Decor',
  'Documents & stationery',
  'Health',
  'Kids & toys',
  'Sports & hobbies',
  'Garden & outdoor',
  'Vehicle & travel',
  'Pets',
  'Storage & misc',
];

export const ICON_KEYS = Object.keys(ITEM_ICONS);

// Brand marks are stored as "brand:<slug>" and drawn from files, through a CSS
// mask, so they follow the text colour. Everything else is an inline line icon.
export const isBrandKey = (key) => typeof key === 'string' && key.startsWith('brand:');

export const iconLabel = (key) =>
  isBrandKey(key) ? BRAND_ICONS[key.slice(6)] || '' : ITEM_ICONS[key]?.label || '';

export const itemIconSVG = (key, cls = 'w-5 h-5') => {
  if (isBrandKey(key)) {
    const slug = key.slice(6);
    if (!BRAND_ICONS[slug]) return '';
    return `<span class="brand-glyph ${cls}" role="img" aria-label="${BRAND_ICONS[slug]}"
      style="--u:url(/static/icons/brands/${slug}.svg)"></span>`;
  }
  const def = ITEM_ICONS[key];
  if (!def) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${def.path}</svg>`;
};

// suggestIcon guesses from what the user already typed. Longer keywords win, so
// "power bank" beats "power", and a whole-word match beats a substring.
export function suggestIcon(name = '', tags = []) {
  const hay = `${name} ${tags.join(' ')}`.toLowerCase();
  if (!hay.trim()) return '';

  let best = '';
  let bestScore = 0;
  for (const [key, def] of Object.entries(ITEM_ICONS)) {
    for (const word of def.keywords) {
      if (!hay.includes(word)) continue;
      const whole = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay);
      const score = word.length + (whole ? 10 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = key;
      }
    }
  }
  return best;
}
