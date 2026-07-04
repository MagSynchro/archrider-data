// deckProbe.js
const db = require('../../database/db.js');
const { throttledFetch } = require('./archidektThrottle.js');

// Shared by scripts/probe.js (CLI) and the credit-gated
// POST /api/decks/:id/probe endpoint -- both need the exact same
// single-deck fetch + card-list/metadata upsert, just with different
// callers around it (CLI logging + JSON dump vs. an HTTP response).
const mapCard = (c) => {
    const categories = c.categories || [];
    return {
        oracleID: c.card.oracleCard.uid,
        printingID: c.card.uid,
        quantity: c.quantity,
        isCommander: categories.includes("Commander"),
        isCompanion: c.companion || false,
        categories: [...new Set([...categories, c.card.oracleCard.defaultCategory].filter(Boolean))],
        customCmc: c.customCmc || c.card.oracleCard.cmc
    };
};

// Fetches the single-deck endpoint, upserts commander_decks + the full
// card list into deck_card_lists, and returns the raw Archidekt response
// (callers decide what else to do with it -- write a JSON dump, build an
// HTTP response, etc.). updated_at comes from Archidekt's own
// data.updatedAt, not NOW() -- it has to reflect when the user last
// changed the deck on Archidekt, not when this sync happened, or the
// updated_at > last_synced "needs sync" signal (see migration 017) would
// never be accurate. last_synced IS the sync-time stamp -- this is the
// one place that's supposed to update it.
async function probeDeckById(id) {
    const url = `https://archidekt.com/api/decks/${id}/`;
    const response = await throttledFetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    const cardList = {
        mainboard: data.cards.filter(c => !(c.categories || []).some(cat => ['sideboard', 'maybeboard'].includes(cat.toLowerCase()))).map(mapCard),
        sideboard: data.cards.filter(c => (c.categories || []).some(cat => cat.toLowerCase() === 'sideboard')).map(mapCard),
        maybeboard: data.cards.filter(c => (c.categories || []).some(cat => cat.toLowerCase() === 'maybeboard')).map(mapCard)
    };

    const colorIdentity = [...new Set(data.cards.flatMap(c => c.card.oracleCard.colorIdentity || []))];
    const cardCount = data.cards.reduce((sum, c) => sum + c.quantity, 0);

    await db.query(`
        INSERT INTO commander_decks (
            archidekt_id, name, card_count, color_identity, owner_username, updated_at, last_synced
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (archidekt_id) DO UPDATE
        SET name = EXCLUDED.name,
            card_count = EXCLUDED.card_count,
            color_identity = EXCLUDED.color_identity,
            updated_at = EXCLUDED.updated_at,
            last_synced = NOW();
    `, [id, data.name, cardCount, JSON.stringify(colorIdentity), data.owner.username, data.updatedAt]);

    await db.query(`
        INSERT INTO deck_card_lists (deck_id, card_list, last_synced)
        VALUES ($1, $2, NOW())
        ON CONFLICT (deck_id) DO UPDATE
        SET card_list = EXCLUDED.card_list,
            last_synced = NOW();
    `, [id, JSON.stringify(cardList)]);

    return data;
}

module.exports = { mapCard, probeDeckById };
