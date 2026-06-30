// gradientUtils.js

const COLOR_CODES = {
  "White": "#fef3c7",
  "Blue": "#2563eb",
  "Black": "#1e293b",
  "Red": "#dc2626",
  "Green": "#16a34a"
};

const COLOR_WHEEL = ["White", "Blue", "Black", "Red", "Green"];

// Define overrides for specific identities that follow a specific directional flow
const IDENTITY_ORDER_OVERRIDES = {
  // Guilds (2-Color)
  "Azorius": ["White", "Blue"],
  "Dimir": ["Blue", "Black"],
  "Rakdos": ["Black", "Red"],
  "Gruul": ["Red", "Green"],
  "Selesnya": ["Green", "White"],
  "Orzhov": ["White", "Black"],
  "Golgari": ["Black", "Green"],
    "Simic": ["Green", "Blue"],
  "Izzet": ["Blue", "Red"],
    "Boros": ["Red", "White"],

  // Shards/Wedges (3-Color)
  "Esper": ["White", "Blue", "Black"],
  "Grixis": ["Blue", "Black", "Red"],
  "Jund": ["Black", "Red", "Green"],
  "Naya": ["Red", "Green", "White"],
  "Bant": ["Green", "White", "Blue"],
  "Abzan": ["White", "Black", "Green"],
  "Jeskai": ["Blue", "Red", "White"],
  "Sultai": ["Black", "Green", "Blue"],
  "Mardu": ["Red", "White", "Black"],  
  "Temur": ["Green", "Blue", "Red"],
  


  // 4-Color
  "Glint-Eye": ["Blue", "Black", "Red", "Green"],
  "Dune-Brood": ["Black", "Red", "Green", "White"],
  "Yore-Tiller": ["White", "Blue", "Black", "Red"],
  "Witch-Maw": ["Green", "White", "Blue", "Black"],
  "Ink-Treader": ["Red", "Green","White", "Blue"],

  // 5-Color
  "5 Color": ["White", "Blue", "Black", "Red", "Green"]
  // Add other exceptions here as you find them
};

export const getDynamicGradientStyle = (colorArray, identityName) => {
  if (!Array.isArray(colorArray) || colorArray.length === 0) return { background: "#e2e8f0" };

  // Check for the override first
  let orderedColors = IDENTITY_ORDER_OVERRIDES[identityName];

  // If no override, use the standard WUBRG sort
  if (!orderedColors) {
    orderedColors = [...colorArray].sort((a, b) =>
      COLOR_WHEEL.indexOf(a) - COLOR_WHEEL.indexOf(b)
    );
  }

  const stops = orderedColors.map(c => COLOR_CODES[c]).join(', ');

  return { background: `linear-gradient(90deg, ${stops})` };
};
