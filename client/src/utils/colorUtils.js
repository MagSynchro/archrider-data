//colorUtils.js
const IDENTITY_MAP = {
    // Mono
    "Black": "Mono-Black",
    "Blue": "Mono-Blue",
    "Green": "Mono-Green",
    "Red": "Mono-Red",
    "White": "Mono-White",

    // Guilds (2-Color)
    "Black,Blue": "Dimir",
    "Black,Green": "Golgari",
    "Black,Red": "Rakdos",
    "Black,White": "Orzhov",
    "Blue,Green": "Simic",
    "Blue,Red": "Izzet",
    "Blue,White": "Azorius",
    "Green,Red": "Gruul",
    "Green,White": "Selesnya",
    "Red,White": "Boros",

    // Shards/Wedges (3-Color)
    "Black,Blue,Red": "Grixis",
    "Black,Green,Red": "Jund",
    "Black,Green,White": "Abzan",
    "Black,Blue,White": "Esper",
    "Black,Blue,Green": "Sultai",
    "Blue,Red,White": "Jeskai",
    "Blue,Green,White": "Bant",
    "Blue,Green,Red": "Temur",
    "Green,Red,White": "Naya",
    "Black,Red,White": "Mardu",

    // 4-Color
    "Black,Blue,Green,Red": "Glint-Eye",
    "Black,Green,Red,White": "Dune-Brood",
    "Black,Blue,Red,White": "Yore-Tiller",
    "Black,Blue,Green,White": "Witch-Maw",
    "Blue,Green,Red,White": "Ink-Treader",

    // 5-Color
    "Black,Blue,Green,Red,White": "5 Color"
};

export const getColorIdentityName = (symbolsArray) => {
    // Sort alphabetically to ensure ['U', 'W'] matches ['W', 'U']
    const key = [...symbolsArray].sort().join(',');
    return IDENTITY_MAP[key] || "Colorless";
};
