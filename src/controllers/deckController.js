// deckController.js
const db = require('../../database/db.js');

exports.getAllDecks = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM commander_decks');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch decks" });
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
                cf.type_line, cf.mana_cost
            FROM cards c
            LEFT JOIN card_faces cf ON cf.parent_oracle_id = c.oracle_id
            WHERE c.oracle_id = ANY($1)
            ORDER BY c.oracle_id, cf.id ASC
        `;
        const { rows: metaRows } = await db.query(metaQuery, [uniqueIds]);

        // 4. Create a map for quick lookup: { oracle_id: { name, card_category, normalized_category, type_line, mana_cost } }
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

        // 5. Enrich the deck object with names + taxonomy categories + type_line + manaCost
        const enrich = (list) => list.map(c => {
            const meta = cardMetaMap[c.oracleID];
            const override = overrideMap[c.oracleID];
            return {
                ...c,
                name: meta?.name || "Unknown Card",
                card_category: override?.card_category || meta?.card_category || null,
                normalized_category: override?.normalized_category || meta?.normalized_category || null,
                isOverridden: Boolean(override),
                type_line: meta?.type_line || null,
                manaCost: meta?.mana_cost || null
            };
        });

        res.json({
            ...deck,
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