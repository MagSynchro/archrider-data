// cardTypeUtils.js
// Derives a coarse display bucket from a Scryfall type_line, e.g.
// "Legendary Creature — Human Cleric" -> "Creatures".
// Used as the last-resort grouping fallback for cards with neither a
// normalized_category nor a card_category from the taxonomy.

const TYPE_PRIORITY = [
    'Creature',
    'Planeswalker',
    'Battle',
    'Land',
    'Instant',
    'Sorcery',
    'Artifact',
    'Enchantment'
];

export function getCardTypeBucket(typeLine) {
    if (!typeLine) return null;

    // Everything before the em dash is the card's actual type(s);
    // everything after is subtype (creature type, land type, etc.)
    // and shouldn't influence bucketing.
    const mainTypes = typeLine.split('—')[0];

    for (const type of TYPE_PRIORITY) {
        if (mainTypes.includes(type)) {
            return `${type}s`;
        }
    }

    return 'Other';
}