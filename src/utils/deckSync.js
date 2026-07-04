// deckSync.js
const db = require('../../database/db.js');

const COLOR_CODE_TO_NAME = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

// Cheap approximation of color identity from the deck-listing endpoint's
// own `colors` field (a count of cards containing each color's mana
// symbol) -- available for free from the same response this sync
// already fetches, unlike the accurate color_identity probe.js derives
// from each card's actual Scryfall color identity (which also accounts
// for color indicators and identity-granting abilities that mana
// symbols alone miss -- e.g. a blue card with a green activated ability).
// Only ever used to fill in a still-unknown color_identity, never to
// overwrite one probe.js has already confirmed -- see the CASE in the
// UPDATE SET below. UserDeckTable/DeckTable mark this approximation
// visibly (a "?" on the nameplate) whenever last_synced is still null,
// since it's known to be less reliable than a probe.
function deriveApproxColorIdentity(colors) {
    if (!colors) return null;
    return Object.entries(colors)
        .filter(([, count]) => count > 0)
        .map(([code]) => COLOR_CODE_TO_NAME[code])
        .filter(Boolean);
}

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
        // The "or last_synced IS NULL" clause matters beyond just this call:
        // without it, a deck whose updated_at looks unchanged since the last
        // sync would skip the whole UPDATE (Postgres doesn't apply an
        // ON CONFLICT UPDATE at all when its WHERE is false), so a
        // never-probed deck's color_identity backfill above would never
        // actually run. It also fixes a latent gap in scout.js's CLI
        // pipeline: wasUpdated drives whether it triggers a probe, so a
        // deck discovered via the web Sync Decklist action (never probed)
        // but not re-fetched with a newer updated_at would otherwise never
        // get probed by a later `node scripts/scout.js` run either.
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
                updated_at = EXCLUDED.updated_at,
                -- Never downgrade a probe-confirmed color_identity back to
                -- this cheap approximation -- only fill it in while the
                -- deck has never been individually synced.
                color_identity = CASE
                    WHEN commander_decks.last_synced IS NULL THEN EXCLUDED.color_identity
                    ELSE commander_decks.color_identity
                END
             ${force ? '' : `WHERE commander_decks.updated_at < EXCLUDED.updated_at
                              OR commander_decks.last_synced IS NULL`}`,
            [
                deck.id,
                deck.name,
                deck.size,
                deck.deckFormat,
                JSON.stringify(deriveApproxColorIdentity(deck.colors)),
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
