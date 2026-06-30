require('dotenv').config();
const db = require('../database/db.js');
const { writeJsonFile } = require('./utils/fileHelper.js');

const deckId = process.argv[2];


if (!deckId) {
  console.error("Usage: node probe.js <deck_id>");
  process.exit(1);
}

const sanitize = (str) => str.replace(/[^a-z0-9]/gi, '_').toLowerCase();

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

async function probeDeck(id) {
  try {
    const url = `https://archidekt.com/api/decks/${id}/`;
    console.log(`Probing deck: ${id}...`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    // 1. Process Data
    const cardList = {
      mainboard: data.cards.filter(c => !(c.categories || []).some(cat => ['sideboard', 'maybeboard'].includes(cat.toLowerCase()))).map(mapCard),
      sideboard: data.cards.filter(c => (c.categories || []).some(cat => cat.toLowerCase() === 'sideboard')).map(mapCard),
      maybeboard: data.cards.filter(c => (c.categories || []).some(cat => cat.toLowerCase() === 'maybeboard')).map(mapCard)
    };

    const colorIdentity = [...new Set(data.cards.flatMap(c => c.card.oracleCard.colorIdentity || []))];
    const cardCount = data.cards.reduce((sum, c) => sum + c.quantity, 0);

    // 2. Sync Metadata - This happens first
    await db.query(`
      INSERT INTO commander_decks (
        archidekt_id, name, card_count, color_identity, owner_username, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (archidekt_id) DO UPDATE 
      SET name = EXCLUDED.name,
          card_count = EXCLUDED.card_count,
          color_identity = EXCLUDED.color_identity,
          updated_at = NOW(); -- Keeps this row updated with the sync time
    `, [id, data.name, cardCount, JSON.stringify(colorIdentity), data.owner.username]);
    
    console.log(`Metadata synced for ${id}.`);

    // 3. Sync Card List (Probe table) - This happens second
    await db.query(`
      INSERT INTO deck_card_lists (deck_id, card_list, last_synced)
      VALUES ($1, $2, NOW())
      ON CONFLICT (deck_id) DO UPDATE 
      SET card_list = EXCLUDED.card_list,
          last_synced = NOW();
    `, [id, JSON.stringify(cardList)]);

    console.log(`Card list synced for ${id}.`);

    writeJsonFile(`probe_${sanitize(data.name)}_${id}.json`, data);
    
  } catch (error) {
    console.error("Probe failed:", error.message);
    process.exit(1); // Exit with error so you know it failed
  }
}

probeDeck(deckId);