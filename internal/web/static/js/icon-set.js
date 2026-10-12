// A wide set of household icons, for the things nobody wants to photograph.
//
// Same rules as item-icons.js: stroke-only, 24x24, drawn with round caps and
// joins at 1.7px, so a new icon sits next to an old one without looking foreign.
// The key is stored on the item, so keys here are a stable API too.
//
// `group` is how the picker sections them; `keywords` is what typing a name
// matches against (and what suggests the icon while the item name is typed).

const g = (group, entries) =>
  Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, { group, ...v }]));

export const EXTRA_ICONS = {
  ...g('Electronics', {
    earbuds: {
      label: 'Earbuds',
      keywords: ['earbuds', 'airpods', 'buds', 'earphones spare', 'in-ear'],
      path: '<circle cx="7" cy="8" r="3"/><path d="M7 11v8"/><circle cx="17" cy="8" r="3"/><path d="M17 11v8"/>',
    },
    charger: {
      label: 'Charger',
      keywords: ['charger', 'adapter', 'adaptor', 'power brick', 'wall charger'],
      path: '<rect x="6" y="7" width="12" height="11" rx="2"/><path d="M9 7V4M15 7V4M12 18v3"/>',
    },
    powerbank: {
      label: 'Power bank',
      keywords: ['power bank', 'powerbank', 'portable charger'],
      path: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 7h4M10 11h4M12 17h.01"/>',
    },
    usbstick: {
      label: 'USB stick',
      keywords: ['usb', 'pendrive', 'pen drive', 'flash drive', 'thumb drive'],
      path: '<rect x="8" y="9" width="8" height="12" rx="1.5"/><path d="M10 9V4h4v5M11 14h2"/>',
    },
    sdcard: {
      label: 'Memory card',
      keywords: ['sd card', 'memory card', 'microsd', 'micro sd'],
      path: '<path d="M7 3h7l3 3v15H7z"/><path d="M10 7v3M12.5 7v3M15 7v3"/>',
    },
    harddrive: {
      label: 'Hard drive',
      keywords: ['hard drive', 'hdd', 'ssd', 'external drive', 'backup drive', 'nas'],
      path: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 14h5M17 14h.01"/>',
    },
    keyboard: {
      label: 'Keyboard',
      keywords: ['keyboard', 'keys', 'mechanical'],
      path: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    },
    mouse: {
      label: 'Mouse',
      keywords: ['mouse', 'trackpad', 'trackball'],
      path: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 3v6"/>',
    },
    speaker: {
      label: 'Speaker',
      keywords: ['speaker', 'bluetooth speaker', 'soundbar', 'alexa', 'echo', 'homepod'],
      path: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="15" r="3"/><circle cx="12" cy="7" r="1"/>',
    },
    smartwatch: {
      label: 'Smartwatch',
      keywords: ['smartwatch', 'fitness band', 'fitbit', 'apple watch', 'band'],
      path: '<rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M9 7l.7-4h4.6l.7 4M9 17l.7 4h4.6l.7-4"/>',
    },
    tablet: {
      label: 'Tablet',
      keywords: ['tablet', 'ipad', 'kindle', 'e-reader', 'ereader'],
      path: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>',
    },
    gamepad: {
      label: 'Game controller',
      keywords: ['controller', 'gamepad', 'playstation', 'xbox', 'joystick', 'console', 'nintendo'],
      path: '<path d="M7 7h10a4 4 0 014 4v2a3 3 0 01-5.2 2L14 13h-4l-1.8 2A3 3 0 013 13v-2a4 4 0 014-4z"/><path d="M8 10v3M6.5 11.5h3M16 10.5h.01M18 12.5h.01"/>',
    },
    remote: {
      label: 'Remote',
      keywords: ['remote', 'remote control', 'clicker'],
      path: '<rect x="8" y="2.5" width="8" height="19" rx="3"/><circle cx="12" cy="7" r="1.5"/><path d="M10.5 12h3M10.5 16h3"/>',
    },
    printer: {
      label: 'Printer',
      keywords: ['printer', 'scanner', 'cartridge', 'ink', 'toner'],
      path: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    },
    webcam: {
      label: 'Webcam',
      keywords: ['webcam', 'cctv', 'security camera', 'ring', 'doorbell camera'],
      path: '<circle cx="12" cy="10" r="6"/><circle cx="12" cy="10" r="2.5"/><path d="M12 16v3M8 21h8"/>',
    },
    microphone: {
      label: 'Microphone',
      keywords: ['microphone', 'mic', 'podcast', 'lavalier'],
      path: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/>',
    },
    drone: {
      label: 'Drone',
      keywords: ['drone', 'quadcopter', 'dji'],
      path: '<rect x="9" y="10" width="6" height="4" rx="1"/><path d="M9 11L5 7M15 11l4-4M9 13l-4 4M15 13l4 4"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/>',
    },
    tripod: {
      label: 'Tripod',
      keywords: ['tripod', 'stand', 'gimbal', 'selfie stick', 'light stand'],
      path: '<rect x="9" y="2.5" width="6" height="4" rx="1"/><path d="M12 6.5V12M12 12l-5 9M12 12l5 9M12 12v9"/>',
    },
    binoculars: {
      label: 'Binoculars',
      keywords: ['binoculars', 'telescope', 'spotting scope'],
      path: '<circle cx="7" cy="16" r="4"/><circle cx="17" cy="16" r="4"/><path d="M7 12V6h3v6M14 12V6h3v6M10 15h4"/>',
    },
  }),

  ...g('Power & cables', {
    powerstrip: {
      label: 'Power strip',
      keywords: ['power strip', 'extension', 'extension board', 'surge', 'multiplug', 'socket board'],
      path: '<rect x="2.5" y="8" width="19" height="8" rx="2"/><path d="M7 11v2M12 11v2M17 11v2"/>',
    },
    socket: {
      label: 'Wall socket',
      keywords: ['socket', 'outlet', 'switch plate', 'travel adapter'],
      path: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 9v2M15 9v2M10 16h4"/>',
    },
    lightswitch: {
      label: 'Light switch',
      keywords: ['light switch', 'switch', 'dimmer'],
      path: '<rect x="7" y="3" width="10" height="18" rx="2"/><rect x="10" y="7" width="4" height="6" rx="1"/>',
    },
    flashlight: {
      label: 'Torch',
      keywords: ['torch', 'flashlight', 'headlamp', 'lantern light'],
      path: '<path d="M8 3h8v5l-2 3v10h-4V11L8 8z"/><path d="M12 14h.01"/>',
    },
    lantern: {
      label: 'Lantern',
      keywords: ['lantern', 'camp light', 'emergency light'],
      path: '<rect x="7" y="6" width="10" height="14" rx="2"/><path d="M9 6V4h6v2M12 10v6M7 11h10"/>',
    },
    smokealarm: {
      label: 'Smoke alarm',
      keywords: ['smoke alarm', 'smoke detector', 'co2', 'carbon monoxide', 'sensor'],
      path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 5v1M12 18v1M5 12h1M18 12h1"/>',
    },
  }),

  ...g('Appliances', {
    fridge: {
      label: 'Fridge',
      keywords: ['fridge', 'refrigerator', 'freezer'],
      path: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 6v1.5M9 13v3"/>',
    },
    washer: {
      label: 'Washing machine',
      keywords: ['washing machine', 'washer', 'dryer', 'tumble'],
      path: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><circle cx="12" cy="14" r="4.5"/><path d="M7 6h.01M10 6h.01"/>',
    },
    microwave: {
      label: 'Microwave',
      keywords: ['microwave', 'oven', 'air fryer', 'airfryer'],
      path: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><rect x="5" y="8" width="9" height="8" rx="1"/><path d="M17.5 9h.01M17.5 13h1.5"/>',
    },
    fan: {
      label: 'Fan',
      keywords: ['fan', 'cooler', 'ceiling fan', 'pedestal fan'],
      path: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 3-4 7zM14 12c4 0 7 1 7 4 0 2-3 2-7-4zM12 14c0 4-1 7-4 7-2 0-2-3 4-7zM10 12c-4 0-7-1-7-4 0-2 3-2 7 4z"/>',
    },
    aircon: {
      label: 'Air conditioner',
      keywords: ['ac', 'air conditioner', 'aircon', 'heater', 'air purifier', 'humidifier'],
      path: '<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M7 15l-1 3M12 15v4M17 15l1 3"/>',
    },
    iron: {
      label: 'Iron',
      keywords: ['iron', 'steamer', 'garment steamer'],
      path: '<path d="M3 18c0-3 2-6 6-6h6a6 6 0 016 6z"/><path d="M9 12V8h5M11 15h.01"/>',
    },
    vacuum: {
      label: 'Vacuum',
      keywords: ['vacuum', 'hoover', 'robot vacuum', 'roomba', 'dyson'],
      path: '<circle cx="8" cy="17" r="4"/><path d="M12 17h9v-3M16 3l-5 10"/>',
    },
    blender: {
      label: 'Blender',
      keywords: ['blender', 'mixer', 'grinder', 'juicer', 'food processor'],
      path: '<path d="M7 3h10l-1.5 12h-7z"/><rect x="8" y="15" width="8" height="6" rx="1.5"/><path d="M6 3h12"/>',
    },
    toaster: {
      label: 'Toaster',
      keywords: ['toaster', 'sandwich maker', 'grill', 'waffle'],
      path: '<rect x="3" y="9" width="18" height="10" rx="3"/><path d="M8 9V7a1 1 0 011-1h6a1 1 0 011 1v2M17 14h.01"/>',
    },
    coffeemaker: {
      label: 'Coffee maker',
      keywords: ['coffee maker', 'coffee machine', 'espresso', 'nespresso', 'french press', 'moka'],
      path: '<path d="M5 3h14v6H5zM7 9v12h10V9M9 15h6"/>',
    },
    kettle: {
      label: 'Kettle',
      keywords: ['kettle', 'electric kettle', 'teapot', 'tea'],
      path: '<path d="M6 21h11l1-10H5z"/><path d="M9 11V6a2 2 0 014 0v5M18 14h2.5a1 1 0 011 1v2a1 1 0 01-1 1H18"/>',
    },
  }),

  ...g('Tools', {
    wrench: {
      label: 'Spanner',
      keywords: ['wrench', 'spanner', 'adjustable', 'socket set', 'ratchet'],
      path: '<path d="M5 19l8-8"/><path d="M13 11a4 4 0 105.5-5.5l-2 2-2-.5-.5-2 2-2A4 4 0 0013 11z"/>',
    },
    pliers: {
      label: 'Pliers',
      keywords: ['pliers', 'cutters', 'wire cutter', 'crimper', 'tongs'],
      path: '<path d="M9 3c0 4 3 5 3 8M15 3c0 4-3 5-3 8M12 11l-4 10M12 11l4 10"/>',
    },
    saw: {
      label: 'Saw',
      keywords: ['saw', 'hacksaw', 'jigsaw', 'handsaw'],
      path: '<path d="M3 17l12-12 4 4L7 21z"/><path d="M6 14l2 2M9 11l2 2M12 8l2 2"/>',
    },
    tapemeasure: {
      label: 'Tape measure',
      keywords: ['tape measure', 'measuring tape', 'measure'],
      path: '<circle cx="10" cy="12" r="7"/><circle cx="10" cy="12" r="2.5"/><path d="M17 12h4v4h-4"/>',
    },
    spiritlevel: {
      label: 'Spirit level',
      keywords: ['spirit level', 'level', 'laser level'],
      path: '<rect x="2.5" y="9" width="19" height="6" rx="1.5"/><rect x="10" y="10.5" width="4" height="3" rx="1"/><path d="M6 12h.01M18 12h.01"/>',
    },
    allenkey: {
      label: 'Allen key',
      keywords: ['allen key', 'hex key', 'allen', 'hex wrench', 'ikea key'],
      path: '<path d="M5 5h9v14h5"/>',
    },
    scissors: {
      label: 'Scissors',
      keywords: ['scissors', 'shears', 'snips'],
      path: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5L21 19M8.5 16.5L21 5"/>',
    },
    ladder: {
      label: 'Ladder',
      keywords: ['ladder', 'step stool', 'stepladder'],
      path: '<path d="M7 3l-1 18M17 3l1 18M6.5 8h11M6.2 14h11.6"/>',
    },
    glue: {
      label: 'Glue',
      keywords: ['glue', 'adhesive', 'superglue', 'silicone', 'sealant', 'epoxy'],
      path: '<path d="M9 3h6v4l2 3v11H7V10l2-3z"/><path d="M10 14h4"/>',
    },
    toolbox: {
      label: 'Toolbox',
      keywords: ['toolbox', 'tool kit', 'toolkit', 'tool bag'],
      path: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5a1 1 0 011-1h4a1 1 0 011 1v3M3 13h18M11 13v2h2v-2"/>',
    },
    nuts: {
      label: 'Nuts & bolts',
      keywords: ['nut', 'bolt', 'washer', 'fastener', 'hex nut'],
      path: '<path d="M8 4h8l5 8-5 8H8l-5-8z"/><circle cx="12" cy="12" r="3"/>',
    },
    paintbrush: {
      label: 'Paintbrush',
      keywords: ['paintbrush', 'brush', 'roller', 'paint brush'],
      path: '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-4 2-4 4s-1 3-2 4c3 1 7 0 8-3z"/>',
    },
    magnet: {
      label: 'Magnet',
      keywords: ['magnet', 'magnetic'],
      path: '<path d="M5 3v9a7 7 0 0014 0V3h-4v9a3 3 0 01-6 0V3z"/><path d="M5 7h4M15 7h4"/>',
    },
    extinguisher: {
      label: 'Fire extinguisher',
      keywords: ['fire extinguisher', 'extinguisher', 'fire blanket'],
      path: '<path d="M9 8h6v13H9zM12 8V5h4M16 5l3 2"/><path d="M9 14h6"/>',
    },
  }),

  ...g('Kitchen', {
    pot: {
      label: 'Pot',
      keywords: ['pot', 'saucepan', 'pressure cooker', 'cooker', 'casserole', 'stockpot'],
      path: '<path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3z"/><path d="M2 10h2M20 10h2M8 10V7h8v3"/>',
    },
    plate: {
      label: 'Plates',
      keywords: ['plate', 'plates', 'dinner set', 'crockery', 'bowl', 'dishes'],
      path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
    },
    cutlery: {
      label: 'Cutlery',
      keywords: ['cutlery', 'fork', 'spoon', 'knife', 'silverware', 'utensils'],
      path: '<path d="M6 3v6a2 2 0 004 0V3M8 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
    },
    glass: {
      label: 'Glass',
      keywords: ['glass', 'glasses set', 'tumbler', 'cup'],
      path: '<path d="M7 3h10l-1 15a2 2 0 01-2 2h-4a2 2 0 01-2-2z"/><path d="M7.5 9h9"/>',
    },
    wineglass: {
      label: 'Wine glass',
      keywords: ['wine glass', 'wine', 'champagne', 'barware', 'cocktail'],
      path: '<path d="M8 3h8v5a4 4 0 01-8 0z"/><path d="M12 12v8M8 21h8"/>',
    },
    jar: {
      label: 'Jar',
      keywords: ['jar', 'jars', 'canister', 'pantry', 'container', 'tupperware'],
      path: '<rect x="7" y="3" width="10" height="3" rx="1"/><path d="M6 6h12v13a2 2 0 01-2 2H8a2 2 0 01-2-2z"/><path d="M6 10h12"/>',
    },
    chopboard: {
      label: 'Chopping board',
      keywords: ['chopping board', 'cutting board', 'board', 'rolling pin'],
      path: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="7" r="1"/>',
    },
    knife: {
      label: 'Knife',
      keywords: ['kitchen knife', 'chef knife', 'cleaver', 'knife block', 'peeler'],
      path: '<path d="M4 20l9-9M13 11l5-8c2 2 3 5 1 9l-6 4z"/>',
    },
    lunchbox: {
      label: 'Lunchbox',
      keywords: ['lunchbox', 'lunch box', 'tiffin', 'tiffin box', 'bento'],
      path: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M3 13h18"/>',
    },
    thermos: {
      label: 'Flask',
      keywords: ['flask', 'thermos', 'water bottle', 'vacuum flask', 'tumbler'],
      path: '<path d="M9 3h6v3H9zM8 6h8v15H8z"/><path d="M8 11h8"/>',
    },
    spices: {
      label: 'Spices',
      keywords: ['spice', 'spices', 'salt', 'pepper', 'masala', 'seasoning', 'shaker'],
      path: '<path d="M9 3h6v4H9zM8 7h8l1 14H7z"/><path d="M10 12h4"/>',
    },
    can: {
      label: 'Tin',
      keywords: ['tin', 'can', 'canned', 'beans', 'soup'],
      path: '<ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v12c0 1.5 3 2.5 6 2.5s6-1 6-2.5V6"/>',
    },
    bread: {
      label: 'Bread',
      keywords: ['bread', 'loaf', 'bakery', 'baking', 'flour'],
      path: '<path d="M5 11a4 4 0 014-6h6a4 4 0 014 6v9H5z"/>',
    },
    apple: {
      label: 'Fruit',
      keywords: ['apple', 'fruit', 'fruits', 'veg', 'vegetables', 'produce'],
      path: '<path d="M12 7c-3-2-8-1-8 5 0 5 3 9 6 9 1 0 1.5-.5 2-.5s1 .5 2 .5c3 0 6-4 6-9 0-6-5-7-8-5z"/><path d="M12 7c0-2 1-3 3-4"/>',
    },
  }),

  ...g('Cleaning', {
    broom: {
      label: 'Broom',
      keywords: ['broom', 'sweep', 'brush', 'dustpan'],
      path: '<path d="M19 4L10 13"/><path d="M10 13c-3-1-6 1-7 6 5 0 8-2 7-6z"/>',
    },
    bucket: {
      label: 'Bucket',
      keywords: ['bucket', 'pail', 'mop bucket', 'mop'],
      path: '<path d="M5 8h14l-2 13H7z"/><path d="M5 8c0-2 3-4 7-4s7 2 7 4"/>',
    },
    sponge: {
      label: 'Sponge',
      keywords: ['sponge', 'scrubber', 'scourer', 'cloth', 'duster'],
      path: '<rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 12h.01M11 11h.01M15 13h.01M18 11h.01"/>',
    },
    spray: {
      label: 'Spray bottle',
      keywords: ['spray', 'spray bottle', 'cleaner', 'disinfectant', 'window cleaner'],
      path: '<path d="M8 21V10h7v11z"/><path d="M10 10V6h5l3-2v6M19 13h2M19 16h2"/>',
    },
    detergent: {
      label: 'Detergent',
      keywords: ['detergent', 'laundry', 'washing liquid', 'bleach', 'fabric softener', 'dish soap'],
      path: '<path d="M8 9h8v12H8zM10 9V5h4v4"/><path d="M8 14h8"/>',
    },
    bin: {
      label: 'Bin',
      keywords: ['bin', 'trash', 'dustbin', 'garbage', 'rubbish', 'waste'],
      path: '<path d="M5 6h14l-1 15H6z"/><path d="M3 6h18M9 6V3h6v3M10 10v7M14 10v7"/>',
    },
    basket: {
      label: 'Laundry basket',
      keywords: ['laundry basket', 'basket', 'hamper', 'clothes basket'],
      path: '<path d="M3 9h18l-2 11H5z"/><path d="M8 9l1 11M16 9l-1 11M3 14h18"/>',
    },
    hanger: {
      label: 'Hanger',
      keywords: ['hanger', 'hangers', 'coat hanger', 'clothes rack', 'drying rack'],
      path: '<path d="M12 8V6a2 2 0 112 2"/><path d="M12 8L3 17h18z"/>',
    },
  }),

  ...g('Bathroom', {
    toothbrush: {
      label: 'Toothbrush',
      keywords: ['toothbrush', 'toothpaste', 'dental', 'floss', 'mouthwash'],
      path: '<path d="M3 21l11-11"/><path d="M14 10l-3-3 5-5 4 4z"/>',
    },
    soap: {
      label: 'Soap',
      keywords: ['soap', 'handwash', 'shampoo bar', 'body wash'],
      path: '<rect x="3" y="9" width="18" height="9" rx="4"/><path d="M8 13h.01"/>',
    },
    razor: {
      label: 'Razor',
      keywords: ['razor', 'shaver', 'trimmer', 'shaving', 'epilator'],
      path: '<path d="M8 3h8l-1 6H9zM12 9v12"/>',
    },
    hairdryer: {
      label: 'Hair dryer',
      keywords: ['hair dryer', 'hairdryer', 'straightener', 'curler', 'styler'],
      path: '<path d="M3 8a5 5 0 015-5h8l5 3v5l-5 3H8a5 5 0 01-5-5z"/><path d="M10 14l-2 7h4l1-5"/>',
    },
    comb: {
      label: 'Comb',
      keywords: ['comb', 'hairbrush', 'hair brush', 'hair clip', 'hair tie'],
      path: '<rect x="3" y="8" width="18" height="6" rx="1"/><path d="M6 14v4M9 14v4M12 14v4M15 14v4M18 14v4"/>',
    },
    towel: {
      label: 'Towel',
      keywords: ['towel', 'bath towel', 'napkin', 'hand towel'],
      path: '<path d="M5 3h14v14H5z"/><path d="M5 17v4h14v-4M8 8h8M8 12h8"/>',
    },
    toiletroll: {
      label: 'Tissue',
      keywords: ['toilet paper', 'tissue', 'tissues', 'paper towel', 'kitchen roll'],
      path: '<path d="M5 8a6 4 0 0112 0v8a6 4 0 01-12 0z"/><ellipse cx="11" cy="8" rx="2" ry="1.3"/>',
    },
    cosmetics: {
      label: 'Cosmetics',
      keywords: ['perfume', 'cosmetics', 'makeup', 'skincare', 'lotion', 'cream', 'deodorant', 'moisturiser'],
      path: '<rect x="6" y="9" width="12" height="12" rx="2"/><path d="M10 9V6h4v3M9 3h6"/>',
    },
    mirror: {
      label: 'Mirror',
      keywords: ['mirror', 'vanity', 'shaving mirror'],
      path: '<ellipse cx="12" cy="10" rx="6" ry="7"/><path d="M12 17v4M9 21h6"/>',
    },
    scale: {
      label: 'Scale',
      keywords: ['scale', 'weighing scale', 'kitchen scale', 'bathroom scale'],
      path: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 9a4 4 0 018 0"/><path d="M12 9l1.5-2"/>',
    },
  }),

  ...g('Clothing', {
    trousers: {
      label: 'Trousers',
      keywords: ['trousers', 'pants', 'jeans', 'shorts', 'leggings'],
      path: '<path d="M7 3h10l1 18h-5l-1-10-1 10H6z"/>',
    },
    dress: {
      label: 'Dress',
      keywords: ['dress', 'skirt', 'saree', 'sari', 'kurta', 'ethnic wear', 'gown'],
      path: '<path d="M9 3l-1 6 3 3-5 9h12l-5-9 3-3-1-6z"/>',
    },
    socks: {
      label: 'Socks',
      keywords: ['socks', 'stockings', 'tights'],
      path: '<path d="M8 3h8v10l4 4v4H9v-3L8 13z"/>',
    },
    scarf: {
      label: 'Scarf',
      keywords: ['scarf', 'muffler', 'shawl', 'stole', 'beanie', 'gloves', 'winter wear'],
      path: '<path d="M5 6c3-2 11-2 14 0v4c-3 2-11 2-14 0z"/><path d="M14 11v9l3-1 1-8"/>',
    },
    belt: {
      label: 'Belt',
      keywords: ['belt', 'suspenders'],
      path: '<rect x="3" y="9" width="18" height="6" rx="1"/><rect x="9" y="8" width="5" height="8" rx="1"/>',
    },
    tie: {
      label: 'Tie',
      keywords: ['tie', 'necktie', 'bow tie', 'cufflinks'],
      path: '<path d="M9 3h6l-1 4 2 12-4 2-4-2 2-12z"/>',
    },
    sunglasses: {
      label: 'Sunglasses',
      keywords: ['sunglasses', 'shades', 'goggles'],
      path: '<circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2M3 14l2-7M21 14l-2-7"/>',
    },
    backpack: {
      label: 'Backpack',
      keywords: ['backpack', 'rucksack', 'school bag', 'laptop bag', 'daypack'],
      path: '<path d="M9 6a3 3 0 016 0"/><rect x="5" y="6" width="14" height="15" rx="4"/><path d="M9 14h6"/>',
    },
    wardrobe: {
      label: 'Wardrobe',
      keywords: ['wardrobe', 'closet', 'almirah', 'cupboard'],
      path: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M10 12h.01M14 12h.01"/>',
    },
  }),

  ...g('Bedroom & furniture', {
    bed: {
      label: 'Bed',
      keywords: ['bed', 'mattress', 'bedding', 'bedroom'],
      path: '<path d="M3 19V7M3 15h18v4M21 15v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11" r="1.5"/>',
    },
    pillow: {
      label: 'Pillow',
      keywords: ['pillow', 'cushion', 'bolster'],
      path: '<rect x="3" y="7" width="18" height="10" rx="4"/><path d="M7 11c3 1 7 1 10 0"/>',
    },
    drawers: {
      label: 'Drawers',
      keywords: ['drawer', 'drawers', 'dresser', 'chest of drawers', 'cabinet'],
      path: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h16M11 8h2M11 16h2"/>',
    },
    curtain: {
      label: 'Curtain',
      keywords: ['curtain', 'curtains', 'blinds', 'drapes'],
      path: '<path d="M3 4h18"/><path d="M5 4v16M5 4c3 2 4 6 4 16"/><path d="M19 4v16M19 4c-3 2-4 6-4 16"/>',
    },
    alarmclock: {
      label: 'Alarm clock',
      keywords: ['alarm clock', 'alarm', 'bedside clock', 'timer'],
      path: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2 2M5 4l3 2M19 4l-3 2"/>',
    },
    chair: {
      label: 'Chair',
      keywords: ['chair', 'stool', 'office chair', 'seat'],
      path: '<path d="M7 3v10M17 3v10M7 8h10M5 13h14M7 13v8M17 13v8"/>',
    },
    sofa: {
      label: 'Sofa',
      keywords: ['sofa', 'couch', 'settee', 'recliner'],
      path: '<path d="M5 11V8a3 3 0 013-3h8a3 3 0 013 3v3"/><path d="M3 12a2 2 0 014 0v3h10v-3a2 2 0 014 0v6H3z"/><path d="M5 18v2M19 18v2"/>',
    },
    table: {
      label: 'Table',
      keywords: ['table', 'desk', 'dining table', 'coffee table', 'side table'],
      path: '<rect x="3" y="7" width="18" height="3" rx="1"/><path d="M6 10v10M18 10v10"/>',
    },
    bookshelf: {
      label: 'Bookshelf',
      keywords: ['bookshelf', 'shelf', 'shelves', 'rack', 'shoe rack'],
      path: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 9h16M4 15h16M8 3v6M12 9v6M15 15v6"/>',
    },
  }),

  ...g('Decor', {
    lamp: {
      label: 'Lamp',
      keywords: ['lamp', 'table lamp', 'floor lamp', 'desk lamp', 'light', 'lampshade'],
      path: '<path d="M8 3h8l3 9H5z"/><path d="M12 12v7M8 21h8"/>',
    },
    plant: {
      label: 'Plant',
      keywords: ['plant', 'houseplant', 'indoor plant', 'succulent', 'flower pot', 'planter'],
      path: '<path d="M12 15V9"/><path d="M12 11c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c0-3 2-5 5-5 0 3-2 5-5 5z"/><path d="M8 21h8l-1-6H9z"/>',
    },
    frame: {
      label: 'Picture frame',
      keywords: ['frame', 'picture', 'photo frame', 'painting', 'poster', 'wall art', 'canvas'],
      path: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
    },
    wallclock: {
      label: 'Wall clock',
      keywords: ['wall clock', 'clock'],
      path: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    },
    vase: {
      label: 'Vase',
      keywords: ['vase', 'flower vase', 'flowers', 'showpiece'],
      path: '<path d="M9 3h6l-1 4c4 2 4 8 1 12a2 2 0 01-2 2h-4a2 2 0 01-2-2c-3-4-3-10 1-12z"/>',
    },
    candle: {
      label: 'Candle',
      keywords: ['candle', 'candles', 'incense', 'diya', 'aroma', 'diffuser'],
      path: '<rect x="8" y="10" width="8" height="11" rx="1"/><path d="M12 3c-2 2-2 4 0 5 2-1 2-3 0-5z"/>',
    },
    rug: {
      label: 'Rug',
      keywords: ['rug', 'carpet', 'mat', 'doormat', 'yoga mat'],
      path: '<rect x="3" y="6" width="18" height="12" rx="1"/><rect x="6" y="9" width="12" height="6"/>',
    },
    globe: {
      label: 'Globe',
      keywords: ['globe', 'world map', 'atlas'],
      path: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    },
    trophy: {
      label: 'Trophy',
      keywords: ['trophy', 'award', 'medal', 'cup', 'certificate'],
      path: '<path d="M8 3h8v6a4 4 0 01-8 0zM8 5H4v2a4 4 0 004 4M16 5h4v2a4 4 0 01-4 4M12 13v5M8 21h8"/>',
    },
    balloon: {
      label: 'Party',
      keywords: ['balloon', 'party', 'birthday', 'decoration', 'fairy lights', 'festival'],
      path: '<path d="M12 3c-4 0-6 3-6 6s2 6 6 7c4-1 6-4 6-7s-2-6-6-6z"/><path d="M12 16l-1 2h2l-1 2v2"/>',
    },
  }),

  ...g('Documents & stationery', {
    pen: {
      label: 'Pen',
      keywords: ['pen', 'pens', 'pencil', 'ballpoint', 'fountain pen', 'marker'],
      path: '<path d="M4 20l1-4L17 4l3 3L8 19z"/><path d="M14 7l3 3"/>',
    },
    notebook: {
      label: 'Notebook',
      keywords: ['notebook', 'diary', 'journal', 'planner', 'notepad', 'copy'],
      path: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4"/>',
    },
    folder: {
      label: 'Folder',
      keywords: ['folder', 'file', 'binder', 'portfolio', 'files'],
      path: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    },
    stapler: {
      label: 'Stapler',
      keywords: ['stapler', 'staples', 'punch', 'hole punch'],
      path: '<path d="M3 15l17-5v4l-1 1H4a1 1 0 01-1-1z"/><path d="M3 15v3h16"/>',
    },
    envelope: {
      label: 'Envelope',
      keywords: ['envelope', 'letter', 'mail', 'post', 'stamp', 'courier'],
      path: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    },
    passport: {
      label: 'Passport',
      keywords: ['passport', 'visa', 'travel documents', 'boarding pass'],
      path: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
    },
    idcard: {
      label: 'ID card',
      keywords: ['id card', 'aadhaar', 'aadhar', 'pan card', 'licence', 'license', 'driving licence', 'badge'],
      path: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c0-2 6-2 6 0M15 10h3M15 14h3"/>',
    },
    creditcard: {
      label: 'Bank card',
      keywords: ['credit card', 'debit card', 'bank card', 'atm card', 'cheque book', 'card'],
      path: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    },
    ruler: {
      label: 'Ruler',
      keywords: ['ruler', 'scale ruler', 'set square', 'compass', 'geometry box'],
      path: '<rect x="2.5" y="8" width="19" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
    },
    calculator: {
      label: 'Calculator',
      keywords: ['calculator', 'abacus'],
      path: '<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>',
    },
    stickynote: {
      label: 'Sticky notes',
      keywords: ['sticky note', 'post-it', 'postit', 'notes', 'memo'],
      path: '<path d="M5 3h14v12l-6 6H5z"/><path d="M13 21v-6h6"/>',
    },
    paperclip: {
      label: 'Paperclips',
      keywords: ['paperclip', 'clips', 'binder clip', 'pins', 'rubber band'],
      path: '<path d="M20 11l-8 8a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8"/>',
    },
    sellotape: {
      label: 'Tape',
      keywords: ['sellotape', 'tape', 'masking tape', 'duct tape', 'scotch tape'],
      path: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    },
    certificate: {
      label: 'Certificate',
      keywords: ['certificate', 'degree', 'warranty', 'warranty card', 'receipt', 'invoice', 'bill', 'manual'],
      path: '<rect x="3" y="4" width="18" height="13" rx="1"/><circle cx="12" cy="11" r="3"/><path d="M10 17l-1 4 3-1 3 1-1-4"/>',
    },
    coin: {
      label: 'Money',
      keywords: ['money', 'cash', 'coins', 'change', 'currency', 'savings', 'piggy bank'],
      path: '<circle cx="12" cy="12" r="9"/><path d="M8.5 8h7M8.5 11.5h7M8.5 8c3.5 0 5 1 5 2.2s-1.5 2.3-4 2.3l4.5 4"/>',
    },
    ticket: {
      label: 'Tickets',
      keywords: ['ticket', 'tickets', 'coupon', 'voucher', 'pass'],
      path: '<path d="M3 9V6a2 2 0 012-2h14a2 2 0 012 2v3a3 3 0 000 6v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a3 3 0 000-6z"/><path d="M14 4v2M14 11v2M14 18v2"/>',
    },
  }),

  ...g('Health', {
    pill: {
      label: 'Tablets',
      keywords: ['pill', 'pills', 'tablet strip', 'capsule', 'vitamins', 'supplements', 'paracetamol'],
      path: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/>',
    },
    firstaid: {
      label: 'First aid',
      keywords: ['first aid', 'first aid kit', 'medical kit', 'bandages', 'antiseptic', 'dettol'],
      path: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M12 11v5M9.5 13.5h5"/>',
    },
    thermometer: {
      label: 'Thermometer',
      keywords: ['thermometer', 'bp monitor', 'blood pressure', 'oximeter', 'glucometer'],
      path: '<path d="M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z"/><path d="M12 9v7"/>',
    },
    dumbbell: {
      label: 'Dumbbell',
      keywords: ['dumbbell', 'weights', 'barbell', 'kettlebell', 'gym', 'resistance band'],
      path: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
    },
  }),

  ...g('Kids & toys', {
    teddy: {
      label: 'Soft toy',
      keywords: ['teddy', 'soft toy', 'stuffed toy', 'plush', 'doll'],
      path: '<circle cx="12" cy="13" r="6"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="6.5" r="2.5"/><path d="M10 12h.01M14 12h.01M11 15h2"/>',
    },
    blocks: {
      label: 'Blocks',
      keywords: ['blocks', 'building blocks', 'lego blocks', 'duplo', 'puzzle pieces'],
      path: '<rect x="3" y="12" width="8" height="8"/><rect x="13" y="12" width="8" height="8"/><rect x="8" y="4" width="8" height="8"/>',
    },
    dice: {
      label: 'Dice',
      keywords: ['dice', 'ludo', 'snakes and ladders', 'chess', 'carrom'],
      path: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
    },
    boardgame: {
      label: 'Board game',
      keywords: ['board game', 'monopoly', 'uno', 'playing cards', 'cards', 'game night'],
      path: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>',
    },
    pram: {
      label: 'Pram',
      keywords: ['pram', 'stroller', 'pushchair', 'baby carrier', 'car seat'],
      path: '<circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M3 3h3l2 10h10a6 6 0 00-6-6V13"/>',
    },
    crayons: {
      label: 'Crayons',
      keywords: ['crayons', 'colour pencils', 'color pencils', 'sketch pens', 'drawing', 'colours'],
      path: '<path d="M7 21V9l2-4 2 4v12zM13 21V12l2-3 2 3v9z"/>',
    },
  }),

  ...g('Sports & hobbies', {
    ball: {
      label: 'Ball',
      keywords: ['ball', 'football', 'cricket ball', 'basketball', 'volleyball', 'tennis ball'],
      path: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18"/>',
    },
    racket: {
      label: 'Racket',
      keywords: ['racket', 'racquet', 'badminton', 'tennis', 'bat', 'cricket bat', 'shuttle'],
      path: '<ellipse cx="9" cy="9" rx="6" ry="7" transform="rotate(-45 9 9)"/><path d="M13 13l7 7"/>',
    },
    skateboard: {
      label: 'Skateboard',
      keywords: ['skateboard', 'skates', 'roller skates', 'scooter', 'longboard'],
      path: '<rect x="2" y="9" width="20" height="3" rx="1.5"/><circle cx="6" cy="16" r="1.5"/><circle cx="18" cy="16" r="1.5"/>',
    },
    helmet: {
      label: 'Helmet',
      keywords: ['helmet', 'bike helmet', 'riding helmet', 'hard hat'],
      path: '<path d="M3 15a9 9 0 0118 0v3H3z"/><path d="M3 15h18M12 6v9"/>',
    },
    guitar: {
      label: 'Guitar',
      keywords: ['guitar', 'ukulele', 'violin', 'string instrument', 'banjo'],
      path: '<path d="M14 10l7-7M19 3l2 2"/><circle cx="9" cy="15" r="6"/><circle cx="9" cy="15" r="1.5"/>',
    },
    vinyl: {
      label: 'Vinyl',
      keywords: ['vinyl', 'record', 'lp', 'cd', 'dvd', 'disc', 'cassette'],
      path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 12h.01"/>',
    },
    fishing: {
      label: 'Fishing',
      keywords: ['fishing', 'fishing rod', 'tackle', 'angling'],
      path: '<path d="M4 20L19 4M19 4c2 3 2 6 0 8M19 12a2 2 0 11-3 0"/>',
    },
  }),

  ...g('Garden & outdoor', {
    wateringcan: {
      label: 'Watering can',
      keywords: ['watering can', 'sprinkler', 'garden hose spray'],
      path: '<path d="M4 9h11l1 11H5z"/><path d="M15 12l6-4M4 9a5 5 0 0111 0"/>',
    },
    shovel: {
      label: 'Shovel',
      keywords: ['shovel', 'spade', 'trowel', 'rake', 'hoe', 'secateurs', 'garden tools'],
      path: '<path d="M12 3v10M9 3h6M8 13h8l-1 7h-6z"/>',
    },
    plantpot: {
      label: 'Plant pot',
      keywords: ['pot', 'plant pot', 'seeds', 'soil', 'compost', 'fertiliser', 'grow bag'],
      path: '<path d="M5 12h14l-2 9H7z"/><path d="M12 12V6M12 9c-3 0-4-1-4-3 3 0 4 1 4 3zM12 10c0-2 1-3 4-3 0 2-1 3-4 3z"/>',
    },
    hose: {
      label: 'Hose',
      keywords: ['hose', 'garden hose', 'pipe', 'tubing'],
      path: '<circle cx="8" cy="11" r="5"/><circle cx="8" cy="11" r="1.5"/><path d="M13 11h5a3 3 0 013 3v6M5 21h6"/>',
    },
    grill: {
      label: 'BBQ',
      keywords: ['bbq', 'barbecue', 'grill', 'tandoor', 'charcoal'],
      path: '<path d="M4 10h16a8 8 0 01-16 0z"/><path d="M8 18l-2 3M16 18l2 3M9 6V4M15 6V4"/>',
    },
    cooler: {
      label: 'Cooler',
      keywords: ['cooler', 'ice box', 'picnic', 'icebox', 'hamper'],
      path: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M6 8V5h12v3M9 13h6"/>',
    },
  }),

  ...g('Vehicle & travel', {
    car: {
      label: 'Car',
      keywords: ['car', 'vehicle', 'car accessories', 'dashcam', 'car cover', 'seat cover'],
      path: '<path d="M4 15v-3l2-5h12l2 5v3z"/><path d="M4 12h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
    },
    tyre: {
      label: 'Tyre',
      keywords: ['tyre', 'tire', 'wheel', 'spare wheel', 'rim', 'puncture kit'],
      path: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
    },
    triangle: {
      label: 'Warning triangle',
      keywords: ['warning triangle', 'hazard', 'breakdown', 'reflector'],
      path: '<path d="M12 4L3 20h18z"/><path d="M12 10v4M12 17h.01"/>',
    },
    luggagetag: {
      label: 'Travel kit',
      keywords: ['travel', 'luggage tag', 'travel adapter kit', 'neck pillow', 'toiletry bag', 'pouch'],
      path: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M9 9V6a3 3 0 016 0v3M4 14h16"/>',
    },
  }),

  ...g('Pets', {
    bone: {
      label: 'Pet toy',
      keywords: ['bone', 'pet toy', 'chew', 'dog toy', 'cat toy', 'treats'],
      path: '<path d="M8 5a2.5 2.5 0 00-4 3 2.5 2.5 0 003 3l6 6a2.5 2.5 0 003 3 2.5 2.5 0 004-3 2.5 2.5 0 00-3-3l-6-6a2.5 2.5 0 00-3-3z"/>',
    },
    petbowl: {
      label: 'Pet bowl',
      keywords: ['pet bowl', 'dog bowl', 'cat bowl', 'feeder', 'pet food'],
      path: '<path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 8h8"/>',
    },
    fish: {
      label: 'Aquarium',
      keywords: ['fish', 'aquarium', 'fish tank', 'fish food'],
      path: '<path d="M3 12c3-5 9-5 13 0-4 5-10 5-13 0z"/><path d="M16 12l5-4v8zM8 11h.01"/>',
    },
  }),

  ...g('Storage & misc', {
    padlock: {
      label: 'Lock',
      keywords: ['lock', 'padlock', 'combination lock', 'bike lock', 'safe', 'locker'],
      path: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3M12 15v2"/>',
    },
    shoppingbag: {
      label: 'Shopping bag',
      keywords: ['shopping bag', 'carry bag', 'tote', 'cloth bag', 'reusable bag', 'plastic bags'],
      path: '<path d="M5 7h14l-1 14H6z"/><path d="M9 10V6a3 3 0 016 0v4"/>',
    },
    bin2: {
      label: 'Storage bin',
      keywords: ['storage bin', 'storage box', 'crate', 'organiser', 'organizer', 'caddy'],
      path: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M5 8l1-4h12l1 4M9 12h6"/>',
    },
    hook: {
      label: 'Hooks',
      keywords: ['hook', 'hooks', 'wall hook', 'command strips', 'hanging'],
      path: '<path d="M12 4v8a3 3 0 01-6 0"/><path d="M9 4h6"/>',
    },
    batterypack: {
      label: 'Batteries pack',
      keywords: ['aa', 'aaa', 'coin cell', 'button cell', 'rechargeable'],
      path: '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2M7 12h4M9 10v4"/>',
    },
    calendar: {
      label: 'Calendar',
      keywords: ['calendar', 'wall calendar', 'schedule', 'planner'],
      path: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    },
    cardboard: {
      label: 'Packaging',
      keywords: ['packaging', 'original box', 'boxes', 'bubble wrap', 'packing', 'moving boxes'],
      path: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 11h18M10 7v4M14 7v4"/>',
    },
  }),
  ...g('Pantry & FMCG', {
    biscuits: {
      label: 'Biscuits',
      keywords: ['biscuits', 'biscuit', 'cookies', 'parle-g', 'rusk', 'cream biscuits', 'marie'],
      path: '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M5 8h14M5 16h14"/><circle cx="12" cy="12" r="2.5"/>',
    },
    noodles: {
      label: 'Noodles',
      keywords: ['noodles', 'maggi', 'pasta', 'instant noodles', 'vermicelli', 'ramen', 'sevai'],
      path: '<path d="M3 11h18a9 7 0 01-18 0z"/><path d="M8 11c0-2 2-2 2-4M12 11c0-2 2-2 2-4M16 11c0-2 2-2 2-4"/>',
    },
    chips: {
      label: 'Chips & snacks',
      keywords: ['chips', 'snacks', 'namkeen', 'kurkure', 'bhujia', 'mixture', 'popcorn', 'wafers', 'lays'],
      path: '<path d="M6 3h12l-1 18H7z"/><path d="M6 3l2 1.5L10 3l2 1.5L14 3l2 1.5L18 3"/><circle cx="12" cy="12" r="2.5"/>',
    },
    teabox: {
      label: 'Tea & coffee',
      keywords: ['tea', 'chai', 'coffee', 'tea powder', 'green tea', 'tea bags', 'nescafe', 'bru', 'filter coffee'],
      path: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M6 8h12M10 13c0-2 2-3 4-3 0 2-1 4-4 3z"/>',
    },
    ghee: {
      label: 'Ghee & oil tin',
      keywords: ['ghee', 'oil tin', 'butter', 'vanaspati', 'cooking oil tin', 'amul', 'dalda', 'paneer'],
      path: '<rect x="6" y="6" width="12" height="15" rx="2"/><path d="M8 6V4h8v2M9 12h6M9 16h6"/>',
    },
    atta: {
      label: 'Atta & rice sack',
      keywords: ['atta', 'flour', 'maida', 'besan', 'suji', 'rava', 'rice', 'basmati', 'sugar', 'dal bag', 'grain', 'wheat'],
      path: '<path d="M7 7c0-2 1-4 5-4s5 2 5 4l2 12a2 2 0 01-2 2H7a2 2 0 01-2-2z"/><path d="M8 7h8M12 12v4"/>',
    },
    cookingoil: {
      label: 'Cooking oil',
      keywords: ['cooking oil', 'sunflower oil', 'mustard oil', 'groundnut oil', 'coconut oil', 'olive oil', 'fortune', 'saffola', 'refined oil'],
      path: '<path d="M10 3h4v3l2 3v11a1 1 0 01-1 1H9a1 1 0 01-1-1V9l2-3z"/><path d="M8 13h8M8 17h8"/>',
    },
    pouch: {
      label: 'Pouch & sachet',
      keywords: ['pouch', 'sachet', 'refill', 'detergent pouch', 'surf', 'powder', 'ketchup', 'sauce'],
      path: '<path d="M6 4h12v16H6z"/><path d="M6 8h12M10 13a2 2 0 104 0 2 2 0 10-4 0"/>',
    },
    toothpaste: {
      label: 'Toothpaste',
      keywords: ['toothpaste', 'tube', 'colgate', 'cream tube', 'face wash', 'ointment', 'gel'],
      path: '<path d="M4 19l2-3 12-5 2 3z"/><path d="M17 8l3-1 .5 2-3 1.5"/>',
    },
    shampoo: {
      label: 'Shampoo & lotion',
      keywords: ['shampoo', 'conditioner', 'lotion', 'body wash', 'hair oil', 'handwash', 'sanitiser', 'sanitizer'],
      path: '<rect x="7" y="9" width="10" height="12" rx="2"/><path d="M12 9V5h3M10 14h4"/>',
    },
    chocolate: {
      label: 'Chocolate',
      keywords: ['chocolate', 'candy', 'sweets', 'dairy milk', 'toffee', 'mithai', 'bar'],
      path: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M5 15h14M12 3v18"/>',
    },
    milk: {
      label: 'Milk carton',
      keywords: ['milk', 'dairy', 'curd', 'dahi', 'buttermilk', 'lassi', 'cream', 'milk packet', 'amul'],
      path: '<path d="M7 9l2-5h6l2 5v12H7z"/><path d="M7 9h10M10 13h4"/>',
    },
    juice: {
      label: 'Juice box',
      keywords: ['juice', 'real', 'frooti', 'maaza', 'tetra pack', 'drink', 'soft drink', 'cola', 'energy drink'],
      path: '<rect x="6" y="8" width="12" height="13" rx="1.5"/><path d="M12 8V4l3-1M9 14h6"/>',
    },
    incense: {
      label: 'Agarbatti',
      keywords: ['agarbatti', 'incense', 'incense sticks', 'dhoop', 'cycle', 'pooja', 'puja', 'camphor', 'kapoor'],
      path: '<path d="M5 20L16 5M9 20L17 8M13 20l5-9"/><path d="M16 5c0-1 1-1 1-2M17 8c0-1 1-1 1-2"/>',
    },
    matchbox: {
      label: 'Matchbox',
      keywords: ['matchbox', 'matches', 'lighter', 'ship matches'],
      path: '<rect x="3" y="8" width="18" height="10" rx="1.5"/><path d="M7 4l1 4M11 4l.5 4M3 13h18"/>',
    },
    diya: {
      label: 'Diya',
      keywords: ['diya', 'deepam', 'oil lamp', 'lamp pooja', 'lantern diwali', 'diwali'],
      path: '<path d="M3 14h18c0 4-3 6-9 6s-9-2-9-6z"/><path d="M12 14c-2-1.5-2-4 0-6 2 2 2 4.5 0 6z"/>',
    },
    thali: {
      label: 'Thali',
      keywords: ['thali', 'plate steel', 'katori', 'steel plate', 'pooja thali', 'dinner plate'],
      path: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="2.2"/><circle cx="14" cy="9" r="2"/><circle cx="12" cy="15" r="2.5"/>',
    },
    kadai: {
      label: 'Kadai',
      keywords: ['kadai', 'kadhai', 'wok', 'frying pan', 'deep fry', 'patila', 'vessel'],
      path: '<path d="M3 11h18a9 8 0 01-18 0z"/><path d="M1 11h2M21 11h2"/>',
    },
    tawa: {
      label: 'Tawa',
      keywords: ['tawa', 'roti tawa', 'griddle', 'dosa tawa', 'skillet'],
      path: '<circle cx="10" cy="12" r="7"/><path d="M17 12h5"/>',
    },
    dabba: {
      label: 'Steel dabba',
      keywords: ['dabba', 'steel box', 'masala dabba', 'container steel', 'storage dabba', 'airtight'],
      path: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M5 9V6h14v3M10 6V4h4v2"/>',
    },
    mosquito: {
      label: 'Mosquito repellent',
      keywords: ['mosquito', 'repellent', 'good knight', 'all out', 'vaporizer', 'coil', 'mosquito racket', 'odomos'],
      path: '<rect x="7" y="9" width="10" height="9" rx="1.5"/><path d="M12 9V6M9 21v-3M15 21v-3M9 3c0 2 3 2 3 4"/>',
    },
    dryfruits: {
      label: 'Dry fruits',
      keywords: ['dry fruits', 'almonds', 'cashew', 'raisins', 'nuts', 'dates', 'walnuts', 'pista', 'badam', 'kaju'],
      path: '<path d="M4 11h16a8 7 0 01-16 0z"/><circle cx="9" cy="8" r="1.8"/><circle cx="14" cy="8" r="1.8"/><circle cx="12" cy="5" r="1.5"/>',
    },
    coconut: {
      label: 'Coconut',
      keywords: ['coconut', 'nariyal', 'copra', 'coconut water'],
      path: '<circle cx="12" cy="13" r="8"/><path d="M9.5 12h.01M14.5 12h.01M12 15.5h.01M8 5c1-1.5 3-2 4-2"/>',
    },
  }),
};
