// deckController.js
const db = require('../../database/db.js');

// Decks owned by the logged-in user (see migration 012's user_id column
// and req.user, set by the requireAuth middleware this route is mounted
// behind). hasCardList tells the frontend whether this deck has ever
// been individually probed -- UserDeckTable uses it to decide whether a
// deck's detail view is safe to link to, or whether to offer a
// credit-gated Probe action instead (there's no card_list to show yet).
exports.getMyDecks = async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT cd.*, (dcl.deck_id IS NOT NULL) AS "hasCardList"
             FROM commander_decks cd
             LEFT JOIN deck_card_lists dcl ON dcl.deck_id = cd.archidekt_id
             WHERE cd.user_id = $1
             ORDER BY cd.updated_at DESC NULLS LAST`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching my decks:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getDeckById = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch the Deck
        const deckQuery = `
            SELECT c.*, d.card_list 
            FROM commander_decks c 
            JOIN deck_card_lists d ON c.archidekt_id = d.deck_id 
            WHERE c.archidekt_id = $1;
        `;
        const { rows } = await db.query(deckQuery, [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Deck not found" });

        const deck = rows[0];
        
        // 2. Extract unique oracleIDs for a single bulk query
        const allCards = [...deck.card_list.mainboard, ...deck.card_list.sideboard];
        const uniqueIds = [...new Set(allCards.map(c => c.oracleID))];

        // 3. Bulk fetch names + taxonomy categories from your 'cards' table,
        // plus one representative type_line/mana_cost per card (DISTINCT ON
        // picks the lowest card_faces.id per oracle_id -- for single-faced
        // cards this is the only face; for transform/split cards it's the
        // first face in Scryfall's own face order). type_line is used as the
        // final grouping fallback; mana_cost fixes the color mana curve,
        // which was reading a `manaCost` field that probe.js's mapCard()
        // never actually populated on the raw Archidekt deck JSON.
        const metaQuery = `
            SELECT DISTINCT ON (c.oracle_id)
                c.oracle_id, c.name, c.card_category, c.normalized_category,
                c.card_category_secondary, c.normalized_category_secondary,
                cf.type_line, cf.mana_cost, cf.oracle_text
            FROM cards c
            LEFT JOIN card_faces cf ON cf.parent_oracle_id = c.oracle_id
            WHERE c.oracle_id = ANY($1)
            ORDER BY c.oracle_id, cf.id ASC
        `;
        const { rows: metaRows } = await db.query(metaQuery, [uniqueIds]);

        // 4. Create a map for quick lookup: { oracle_id: { name, card_category, normalized_category, type_line, mana_cost, oracle_text } }
        const cardMetaMap = metaRows.reduce((acc, row) => {
            acc[row.oracle_id] = row;
            return acc;
        }, {});

        // 4b. Deck-scoped manual category overrides (see migration 009).
        // These take priority over the auto-derived taxonomy category when
        // present, but never touch cards.normalized_category itself --
        // the override only affects how this one deck's report groups
        // the card. Stored in a separate table from card_list on purpose:
        // probe.js replaces card_list wholesale on every re-sync, so
        // anything living inside that JSONB blob would be destroyed on
        // the next probe. This table is never touched by probe.js, so
        // overrides survive re-syncs automatically.
        const { rows: overrideRows } = await db.query(
            'SELECT oracle_id, normalized_category, card_category FROM deck_card_overrides WHERE deck_id = $1',
            [id]
        );
        const overrideMap = overrideRows.reduce((acc, row) => {
            acc[row.oracle_id] = row;
            return acc;
        }, {});

        // 4c. This deck's chosen "core synergy" card_category value(s) --
        // see migration 021. Which of the broad SYNERGY bucket's fine-
        // grained SYN_* categories actually represent this deck's
        // build-around theme(s), as opposed to every SYNERGY card getting
        // lumped into one generic pile. Frontend uses this to decide,
        // per-card, whether it matches a chosen theme or should fall back
        // (via card_category_secondary, then raw card type).
        const { rows: coreSynergyRows } = await db.query(
            'SELECT card_category FROM deck_core_synergies WHERE deck_id = $1',
            [id]
        );
        const coreSynergies = coreSynergyRows.map(r => r.card_category);

        // 5. Enrich the deck object with names + taxonomy categories + type_line + manaCost + oracleText
        const enrich = (list) => list.map(c => {
            const meta = cardMetaMap[c.oracleID];
            const override = overrideMap[c.oracleID];
            return {
                ...c,
                name: meta?.name || "Unknown Card",
                card_category: override?.card_category || meta?.card_category || null,
                normalized_category: override?.normalized_category || meta?.normalized_category || null,
                card_category_secondary: meta?.card_category_secondary || null,
                normalized_category_secondary: meta?.normalized_category_secondary || null,
                isOverridden: Boolean(override),
                type_line: meta?.type_line || null,
                manaCost: meta?.mana_cost || null,
                oracleText: meta?.oracle_text || null
            };
        });

        res.json({
            ...deck,
            coreSynergies,
            card_list: {
                mainboard: enrich(deck.card_list.mainboard),
                sideboard: enrich(deck.card_list.sideboard)
            }
        });
    } catch (err) {
        console.error("Error fetching deck:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

const VALID_NORMALIZED_CATEGORIES = ['RAMP', 'TARGETED_INT', 'MASS_INT', 'CARD_DRAW', 'SYNERGY'];

exports.setCardOverride = async (req, res) => {
    const { id, oracleId } = req.params;
    const { normalized_category, card_category } = req.body;

    if (!VALID_NORMALIZED_CATEGORIES.includes(normalized_category)) {
        return res.status(400).json({
            error: `normalized_category must be one of: ${VALID_NORMALIZED_CATEGORIES.join(', ')}`
        });
    }

    try {
        await db.query(
            `INSERT INTO deck_card_overrides (deck_id, oracle_id, normalized_category, card_category, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (deck_id, oracle_id) DO UPDATE SET
                normalized_category = EXCLUDED.normalized_category,
                card_category = EXCLUDED.card_category,
                updated_at = NOW()`,
            [id, oracleId, normalized_category, card_category || null]
        );
        res.json({ deckId: id, oracleId, normalized_category, card_category: card_category || null });
    } catch (err) {
        console.error('Error setting card override:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.clearCardOverride = async (req, res) => {
    const { id, oracleId } = req.params;
    try {
        await db.query(
            'DELETE FROM deck_card_overrides WHERE deck_id = $1 AND oracle_id = $2',
            [id, oracleId]
        );
        res.json({ deckId: id, oracleId, cleared: true });
    } catch (err) {
        console.error('Error clearing card override:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// -- Core synergies (see migration 021) ----------------------------------
// Deck-scoped, user-chosen subset of the SYN_* card_category values
// (under the broad SYNERGY normalized_category) that represent this
// deck's actual build-around theme(s). No ownership/auth check here --
// matching setCardOverride/clearCardOverride above, which have never had
// one either; hardening that is a separate, pre-existing concern, not
// introduced or fixed by this feature.

// Adds one core synergy tag. Idempotent (ON CONFLICT DO NOTHING) since a
// re-click of an already-selected option shouldn't error. Validated
// against real data rather than trusting the client -- must be a
// card_category that's actually mapped to SYNERGY somewhere in `cards`,
// so a typo/junk value can't get stored.
exports.addCoreSynergy = async (req, res) => {
    const { id } = req.params;
    const { card_category } = req.body;

    if (!card_category || typeof card_category !== 'string') {
        return res.status(400).json({ error: 'card_category is required' });
    }

    try {
        const { rows: valid } = await db.query(
            "SELECT 1 FROM cards WHERE card_category = $1 AND normalized_category = 'SYNERGY' LIMIT 1",
            [card_category]
        );
        if (valid.length === 0) {
            return res.status(400).json({ error: `"${card_category}" is not a known SYNERGY card_category` });
        }

        await db.query(
            `INSERT INTO deck_core_synergies (deck_id, card_category)
             VALUES ($1, $2)
             ON CONFLICT (deck_id, card_category) DO NOTHING`,
            [id, card_category]
        );
        res.json({ deckId: id, card_category, added: true });
    } catch (err) {
        console.error('Error adding core synergy:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.removeCoreSynergy = async (req, res) => {
    const { id, category } = req.params;
    try {
        await db.query(
            'DELETE FROM deck_core_synergies WHERE deck_id = $1 AND card_category = $2',
            [id, category]
        );
        res.json({ deckId: id, card_category: category, removed: true });
    } catch (err) {
        console.error('Error removing core synergy:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getDecksByUser = async (req, res) => {
    const { username } = req.params;
    try {
        const query = `
            SELECT 
                archidekt_id, name, card_count, color_identity, 
                owner_username, edh_bracket, updated_at
            FROM commander_decks
            WHERE owner_username = $1
            ORDER BY updated_at DESC;
        `;
        const { rows } = await db.query(query, [username]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "No decks found for this user" });
        }

        res.json(rows);
    } catch (err) {
        console.error("Error fetching decks by user:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};