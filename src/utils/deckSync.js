// deckSync.js
const db = require('../../database/db.js');

// Upserts a fetched Archidekt deck list into commander_decks and, unless
// skipPurge is set, purges any existing rows for this owner that are no
// longer present -- deleted or made non-public since the last sync
// (cascades to deck_card_lists and deck_card_overrides). Shared by
// scripts/scout.js (CLI, which does its own per-deck logging and
// triggers probe.js) and the credit-gated POST /api/decks/me/sync
// endpoint (which must NOT trigger any per-deck probe -- that's a
// separate Archidekt hit the credit-gated single-deck probe action pays
// for on its own).
//
// skipPurge: purging is only safe when `decks` is the COMPLETE current
// list for this owner. The sync endpoint pays for pages incrementally
// and can run out of credits partway through -- in that case the pages
// it did fetch are real, worth keeping, but must not be treated as "the
// whole list" for purge purposes, or decks on unpaid-for pages would
// look deleted.
//
// Deliberately does not touch last_synced -- that column tracks only
// when a specific deck was last fully synced via probe.js, not when this
// cheap master-list scan ran (see migration 017).
async function upsertDeckList(decks, { ownerUsername, force = false, skipPurge = false } = {}) {
    const results = [];
    for (const deck of decks) {
        const result = await db.query(
            `INSERT INTO commander_decks
                (archidekt_id, name, card_count, format_id, color_identity, owner_username, owner_id, edh_bracket, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (archidekt_id) DO UPDATE SET
                name = EXCLUDED.name,
                card_count = EXCLUDED.card_count,
                format_id = EXCLUDED.format_id,
                owner_username = EXCLUDED.owner_username,
                owner_id = EXCLUDED.owner_id,
                edh_bracket = EXCLUDED.edh_bracket,
                updated_at = EXCLUDED.updated_at
             ${force ? '' : 'WHERE commander_decks.updated_at < EXCLUDED.updated_at'}`,
            [
                deck.id,
                deck.name,
                deck.size,
                deck.deckFormat,
                null, // color_identity (populated by probe.js)
                deck.owner.username,
                deck.owner.id,
                deck.edhBracket || null,
                deck.createdAt,
                deck.updatedAt
            ]
        );
        results.push({ deck, wasUpdated: result.rowCount > 0 });
    }

    if (skipPurge || !ownerUsername) {
        return { results, staleDecks: [] };
    }

    const currentIds = new Set(decks.map(d => d.id));
    const { rows: existingDecks } = await db.query(
        'SELECT archidekt_id, name FROM commander_decks WHERE owner_username = $1',
        [ownerUsername]
    );
    const staleDecks = existingDecks.filter(d => !currentIds.has(d.archidekt_id));
    if (staleDecks.length > 0) {
        await db.query('DELETE FROM commander_decks WHERE archidekt_id = ANY($1)', [staleDecks.map(d => d.archidekt_id)]);
    }

    return { results, staleDecks };
}

module.exports = { upsertDeckList };
