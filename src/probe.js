require('dotenv').config();
const db = require('../database/db.js');
const { writeJsonFile } = require('./utils/fileHelper.js');

const deckId = process.argv[2];

if (!deckId) {
  console.error("Usage: node probe.js <deck_id>");
  process.exit(1);
}

// Helper to map card structure
const mapCard = (c) => ({
  oracleID: c.card.oracleCard.uid,
  printingID: c.card.uid,
  quantity: c.quantity,
  isCommander: c.categories.includes("Commander"),
  isCompanion: c.companion || false,
  categories: [...new Set([...c.categories, c.card.oracleCard.defaultCategory].filter(Boolean))],
  customCmc: c.customCmc || c.card.oracleCard.cmc
});

async function probeDeck(id) {
  try {
    const url = `https://archidekt.com/api/decks/${id}/`;
    console.log(`Probing deck: ${id}...`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    // 1. Categorize cards
    const cardList = {
      mainboard: data.cards
        .filter(c => !c.categories.some(cat => ['sideboard', 'maybeboard'].includes(cat.toLowerCase())))
        .map(mapCard),
      sideboard: data.cards
        .filter(c => c.categories.some(cat => cat.toLowerCase() === 'sideboard'))
        .map(mapCard),
      maybeboard: data.cards
        .filter(c => c.categories.some(cat => cat.toLowerCase() === 'maybeboard'))
        .map(mapCard)
    };

    // 2. Aggregate unique colors (Correctly using colorIdentity)
    const colorIdentity = [...new Set(
      data.cards.flatMap(c => c.card.oracleCard.colorIdentity || [])
    )];

    const cardCount = data.cards.reduce((sum, c) => sum + c.quantity, 0);

    // 3. Persist to database (Ensuring variable names match!)
    await db.query(`
      INSERT INTO commander_decks (
        archidekt_id, name, card_count, color_identity, owner_username, card_list, updated_at, last_synced
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (archidekt_id) DO UPDATE 
      SET name = EXCLUDED.name,
          card_count = EXCLUDED.card_count,
          color_identity = EXCLUDED.color_identity,
          card_list = EXCLUDED.card_list,
          updated_at = NOW(),
          last_synced = NOW();
    `, [id, data.name, cardCount, JSON.stringify(colorIdentity), data.owner.username, JSON.stringify(cardList)]);

    console.log(`Deck ${id} successfully synced to database.`);
    writeJsonFile(`probe_${data.name.replace(/\s+/g, '_').toLowerCase()}_${id}.json`, data);
    
  } catch (error) {
    console.error("Probe failed:", error.message);
  }
}

probeDeck(deckId);