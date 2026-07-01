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

        // 3. Bulk fetch names from your 'cards' table
        const metaQuery = `SELECT oracle_id, name FROM cards WHERE oracle_id = ANY($1)`;
        const { rows: metaRows } = await db.query(metaQuery, [uniqueIds]);

        // 4. Create a map for quick lookup: { oracle_id: name }
        const nameMap = metaRows.reduce((acc, row) => {
            acc[row.oracle_id] = row.name;
            return acc;
        }, {});

        // 5. Enrich the deck object with names
        const enrich = (list) => list.map(c => ({
            ...c,
            name: nameMap[c.oracleID] || "Unknown Card"
        }));

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