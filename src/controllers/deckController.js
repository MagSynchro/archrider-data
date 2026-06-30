// src/controllers/deckController.js
const db = require('../../database/db.js');

const getAllDecks = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM commander_decks');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching decks' });
    }
};

module.exports = { getAllDecks };