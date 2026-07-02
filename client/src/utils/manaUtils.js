//manaUtils.js
const isExcluded = (card) => {
    if (card.isCommander || card.isCompanion) return true;

    // Land detection now uses type_line (from our own Scryfall data, always
    // present and reliable) instead of Archidekt's user-assigned category.
    // The old categories[0] check missed any land the deck owner never
    // bothered to categorize, letting it slip into CMC math as a 0-cost
    // colorless spell and skewing the curve low.
    if (card.type_line && card.type_line.includes('Land')) return true;

    // Stickers/Attractions are oddball Un-set card types without a
    // confirmed-reliable type_line shape -- kept on the category-based
    // check rather than guessed at.
    const type = (card.categories?.[0] || "").toLowerCase();
    return type.includes('sticker') || type.includes('attraction');
};

// Helper to extract colors from mana cost
const getColorsFromCost = (cost) => {
    const colors = [];
    if (cost.includes('W')) colors.push('W');
    if (cost.includes('U')) colors.push('U');
    if (cost.includes('B')) colors.push('B');
    if (cost.includes('R')) colors.push('R');
    if (cost.includes('G')) colors.push('G');
    return colors.length > 0 ? colors : ['C'];
};

export const calculateManaCurve = (cards) => {
    const curveMap = {};
    let totalCmc = 0;
    let totalCards = 0;

    cards.forEach(card => {
        if (isExcluded(card)) return;

        const cmc = card.customCmc ?? card.cmc ?? 0;
        const qty = card.quantity || 1;

        // Count CMC 0 cards if you want, or keep the if (cmc === 0) return;
        const bucket = Math.min(cmc, 8);
        curveMap[bucket] = (curveMap[bucket] || 0) + qty;
        
        totalCmc += (cmc * qty);
        totalCards += qty;
    });

    const curve = Array.from({ length: 9 }, (_, i) => ({
        cmc: i === 8 ? '8+' : i.toString(),
        count: curveMap[i] || 0
    }));

    return { curve, averageCmc: totalCards > 0 ? (totalCmc / totalCards).toFixed(2) : 0 };
};

export const calculateColorManaCurves = (cards) => {
    const colorMap = { W: {}, U: {}, B: {}, R: {}, G: {}, C: {} };

    cards.forEach(card => {
        if (isExcluded(card)) return;

        const cmc = Math.min(card.customCmc ?? card.cmc ?? 0, 8);
        const colors = getColorsFromCost(card.manaCost || "");
        const qty = card.quantity || 1;

        colors.forEach(color => {
            if (!colorMap[color][cmc]) colorMap[color][cmc] = 0;
            colorMap[color][cmc] += qty;
        });
    });

    const formattedData = {};
    Object.keys(colorMap).forEach(color => {
        formattedData[color] = Array.from({ length: 9 }, (_, i) => ({
            cmc: i === 8 ? '8+' : i.toString(),
            count: colorMap[color][i] || 0
        }));
    });

    return formattedData;
};