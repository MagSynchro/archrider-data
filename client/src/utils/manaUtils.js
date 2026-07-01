/**
 * Calculates the mana curve and average mana value for a deck.
 * @param {Array} cards - The mainboard card list
 * @returns {Object} { curve: Array, averageCmc: Number }
 */
export const calculateManaCurve = (cards) => {
    const curveMap = {};
    let totalCmc = 0;
    let totalCards = 0;

    cards.forEach(card => {
        // Skip Commanders and Companions
        if (card.isCommander || card.isCompanion) return;

        // SKIP LANDS: Assuming your API/Database populates a 'typeLine' or 'type' field
        // Adjust 'card.typeLine' to match your actual database field name
        if (card.typeLine?.toLowerCase().includes('land')) return;

        // SKIP CMC 0: Only count if cmc > 0
        const cmc = Math.floor(card.customCmc || 0);
        if (cmc === 0) return;

        // Cap at 8+
        const bucket = Math.min(cmc, 8);
        const qty = card.quantity || 1;

        curveMap[bucket] = (curveMap[bucket] || 0) + qty;
        totalCmc += (cmc * qty);
        totalCards += qty;
    });

    const curve = Array.from({ length: 9 }, (_, i) => ({
        cmc: i === 8 ? '8+' : i.toString(),
        count: curveMap[i] || 0
    }));

    return {
        curve,
        averageCmc: totalCards > 0 ? (totalCmc / totalCards).toFixed(2) : 0
    };
};
/**
 * Calculates color distribution for "Cost" and "Production"
 * Note: Requires parsing raw mana symbols from mana_cost strings if not pre-calculated
 */
export const calculateColorDistribution = (cards) => {
    // This is a simplified breakdown. You'll want to expand this 
    // to map specific symbols {W}{U}{B}{R}{G}
    const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    
    // Logic here would iterate through mana_cost strings 
    // or your specific schema fields
    return colors;
};