// scoutController.js
const db = require('../../database/db.js');
const { throttledFetch } = require('../utils/archidektThrottle.js');
const { totalPages, PAGE_SIZE } = require('../utils/archidektDecks.js');
const { upsertDeckList } = require('../utils/deckSync.js');
const { probeDeckById } = require('../utils/deckProbe.js');
const { deductCredits, refundCredits } = require('../utils/credits.js');

// Credit-gated whole-decklist refresh -- the "Sync Decklist" button on
// UserDeckTable. Cost is discovered, not predicted (HANDOFF_CREDITS.md):
// page 1 is fetched first (charging the 1-credit minimum it costs
// regardless), and only once its `count` reveals the true page total do
// we charge for the rest. Never runs probe.js/probeDeckById per deck --
// that's a separate Archidekt hit the single-deck probe action below
// pays for on its own, and bundling it here would make this endpoint's
// cost unbounded instead of ceil(count/50).
exports.syncMyDecks = async (req, res) => {
    const { id: userId, archidektUserId, archidektUsername } = req.user;
    if (!archidektUserId) {
        return res.status(400).json({ error: 'No linked Archidekt account id on file' });
    }

    // Read fresh rather than trust the JWT -- a tier upgrade shouldn't
    // require re-login to take effect on queue priority (see
    // archidektThrottle.js).
    const { rows: tierRows } = await db.query('SELECT tier FROM users WHERE id = $1', [userId]);
    const tier = tierRows[0]?.tier;

    const chargedPage1 = await deductCredits(userId, 1);
    if (!chargedPage1) {
        return res.status(402).json({ error: 'Not enough API credits', creditsNeeded: 1 });
    }

    const firstUrl = `https://archidekt.com/api/decks/v3/?ownerId=${encodeURIComponent(archidektUserId)}&deckFormat=3&pageSize=${PAGE_SIZE}&orderBy=-updatedAt`;
    let firstPageData;
    try {
        const response = await throttledFetch(firstUrl, undefined, { tier });
        if (!response.ok) throw new Error(`Archidekt lookup failed: ${response.status}`);
        firstPageData = await response.json();
    } catch (err) {
        await refundCredits(userId, 1);
        console.error('Error fetching page 1 during decklist sync:', err.message);
        return res.status(502).json({ error: 'Failed to reach Archidekt' });
    }

    const count = firstPageData.count;
    const pages = totalPages(count);
    const allResults = [...(firstPageData.results || [])];
    let creditsSpent = 1;
    let partial = false;
    let creditsNeededForRest = 0;

    if (pages > 1) {
        const remaining = pages - 1;
        const chargedRest = await deductCredits(userId, remaining);
        if (chargedRest) {
            let nextUrl = firstPageData.next;
            try {
                while (nextUrl) {
                    const response = await throttledFetch(nextUrl, undefined, { tier });
                    if (!response.ok) throw new Error(`Archidekt lookup failed: ${response.status}`);
                    const data = await response.json();
                    allResults.push(...(data.results || []));
                    nextUrl = data.next;
                }
                creditsSpent += remaining;
            } catch (err) {
                // The operation as a whole didn't complete -- refund the
                // "rest" charge. Page 1's data (already paid for, already
                // saved below) is real and stays; it just isn't the
                // complete list, so the purge step must be skipped for it.
                await refundCredits(userId, remaining);
                partial = true;
                console.error('Error fetching remaining pages during decklist sync:', err.message);
            }
        } else {
            partial = true;
            creditsNeededForRest = remaining;
        }
    }

    // Purging (treating absence as "deleted on Archidekt") is only valid
    // against a complete list -- skip it whenever we didn't get every page.
    const ownerUsername = allResults[0]?.owner?.username || archidektUsername;
    const { results, staleDecks } = await upsertDeckList(allResults, {
        ownerUsername,
        force: false,
        skipPurge: partial
    });

    // upsertDeckList doesn't set user_id (scout.js's anonymous CLI callers
    // have no concept of a registered ArchRider user). We know exactly who
    // this sync is for, so link any of these decks that aren't already
    // linked -- only fills NULL, never reassigns an already-linked deck.
    if (allResults.length > 0) {
        await db.query(
            'UPDATE commander_decks SET user_id = $1 WHERE archidekt_id = ANY($2) AND user_id IS NULL',
            [userId, allResults.map(d => d.id)]
        );
    }

    await db.query(
        'UPDATE users SET archidekt_deck_count = $1, last_scout_at = NOW() WHERE id = $2',
        [count, userId]
    );

    const { rows } = await db.query('SELECT credits_balance FROM users WHERE id = $1', [userId]);

    res.json({
        totalDecks: count,
        decksSynced: allResults.length,
        decksUpdated: results.filter(r => r.wasUpdated).length,
        decksPurged: staleDecks.length,
        creditsSpent,
        creditsRemaining: rows[0].credits_balance,
        partial,
        creditsNeededForRest: partial ? creditsNeededForRest : undefined
    });
};

// Credit-gated single-deck sync -- the "Probe" action UserDeckTable
// offers for any deck that has no deck_card_lists row yet (never
// individually synced, so there's no card data to display). Requires the
// deck to already exist in commander_decks (discovered via a prior
// decklist sync) and to belong to the requesting user.
exports.probeDeck = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const { rows: deckRows } = await db.query('SELECT user_id FROM commander_decks WHERE archidekt_id = $1', [id]);
        if (deckRows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }
        if (deckRows[0].user_id !== userId) {
            return res.status(403).json({ error: 'You do not own this deck' });
        }

        const { rows: tierRows } = await db.query('SELECT tier FROM users WHERE id = $1', [userId]);
        const tier = tierRows[0]?.tier;

        const charged = await deductCredits(userId, 1);
        if (!charged) {
            return res.status(402).json({ error: 'Not enough API credits', creditsNeeded: 1 });
        }

        try {
            await probeDeckById(id, { tier });
        } catch (err) {
            await refundCredits(userId, 1);
            console.error(`Error probing deck ${id}:`, err.message);
            return res.status(502).json({ error: 'Failed to sync this deck from Archidekt' });
        }

        const { rows } = await db.query('SELECT credits_balance FROM users WHERE id = $1', [userId]);
        res.json({ probed: true, creditsRemaining: rows[0].credits_balance });
    } catch (err) {
        console.error(`Error handling probe request for deck ${id}:`, err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};
