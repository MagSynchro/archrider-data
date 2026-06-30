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
        const query = `
            SELECT 
                c.archidekt_id, c.name, c.card_count, c.color_identity, 
                c.owner_username, c.edh_bracket, c.updated_at,
                d.card_list, d.last_synced
            FROM commander_decks c
            LEFT JOIN deck_card_lists d ON c.archidekt_id = d.deck_id
            WHERE c.archidekt_id = $1;
        `;
        const { rows } = await db.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Deck not found" });
        }

        res.json({
            ...rows[0],
            card_list: rows[0].card_list || null
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