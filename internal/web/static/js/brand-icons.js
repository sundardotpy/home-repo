// Product brand marks, for the things whose brand is the quickest way to
// recognise them: "the Sony one", "the IKEA one".
//
// The marks themselves are SVG files in /static/icons/brands/, vendored from
// Simple Icons (https://simpleicons.org, CC0 1.0, vlatest). They are
// filled glyphs, drawn through a CSS mask so they follow the text colour. Only
// this name index is bundled; the browser fetches a mark when one is shown.
//
// Brands are trademarks of their owners and appear here only to identify the
// owner's own belongings. Simple Icons has removed some brands at their
// owners' request (Philips, Canon, Microsoft, Nintendo and others); they are
// not here. Stored on an item as "brand:<key>".
// Regenerate with scripts/gen-brand-icons.mjs.

export const BRAND_ICONS = {
  "apple": "Apple",
  "samsung": "Samsung",
  "sony": "Sony",
  "lg": "LG",
  "xiaomi": "Xiaomi",
  "ikea": "IKEA",
  "dell": "Dell",
  "hp": "HP",
  "lenovo": "Lenovo",
  "asus": "ASUS",
  "acer": "Acer",
  "huawei": "Huawei",
  "nokia": "Nokia",
  "motorola": "Motorola",
  "oneplus": "OnePlus",
  "oppo": "OPPO",
  "vivo": "vivo",
  "google": "Google",
  "bosch": "Bosch",
  "panasonic": "Panasonic",
  "toshiba": "Toshiba",
  "tplink": "TP-Link",
  "netgear": "NETGEAR",
  "garmin": "Garmin",
  "fitbit": "Fitbit",
  "jbl": "JBL",
  "bose": "Bose",
  "sennheiser": "Sennheiser",
  "beats": "Beats",
  "sonos": "Sonos",
  "roku": "Roku",
  "ring": "Ring",
  "epson": "Epson",
  "intel": "Intel",
  "amd": "AMD",
  "nvidia": "NVIDIA",
  "razer": "Razer",
  "corsair": "Corsair",
  "steelseries": "Steelseries",
  "seagate": "Seagate",
  "nikon": "Nikon",
  "fujifilm": "Fujifilm",
  "leica": "Leica",
  "dji": "DJI",
  "insta360": "Insta360",
  "audiotechnica": "Audio-Technica",
  "playstation": "PlayStation",
  "raspberrypi": "Raspberry Pi",
  "arduino": "Arduino",
  "3m": "3M",
  "nike": "Nike",
  "adidas": "Adidas",
  "puma": "Puma",
  "tata": "Tata",
  "havells": "Havells",
  "boat": "boAt",
  "amul": "Amul",
  "unilever": "Unilever",
  "vim": "Vim",
  "tide": "Tide",
  "wipro": "Wipro",
  "hitachi": "Hitachi",
  "jio": "Jio",
  "airtel": "Airtel",
  "bata": "Bata",
  "bigbasket": "bigbasket",
  "swiggy": "Swiggy",
  "zomato": "Zomato",
  "honda": "Honda",
  "suzuki": "Suzuki",
  "hyundai": "Hyundai",
  "kia": "Kia",
  "toyota": "Toyota",
  "mahindra": "Mahindra",
};

export const BRAND_KEYS = Object.keys(BRAND_ICONS);
