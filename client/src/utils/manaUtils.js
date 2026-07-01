// Helper to check for exclusions
const isExcluded = (card) => {
    const type = (card.categories[0] || "").toLowerCase();
    return (
        card.isCommander || 
        card.isCompanion || 
        type.includes('land') || 
        type.includes('sticker') || 
        type.includes('attraction')
    );
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