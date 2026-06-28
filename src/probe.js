require('dotenv').config();
const db = require('../database/db.js');
const { writeJsonFile } = require('./utils/fileHelper.js');

const deckId = process.argv[2];

if (!deckId) {
  console.error("Usage: node probe.js <deck_id>");
  process.exit(1);
}

async function probeDeck(id) {
  try {
    const url = `https://archidekt.com/api/decks/${id}/`;
    console.log(`Probing deck: ${id}...`);
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    // Use the helper to save the file automatically in src/jsonfetchfiles
    writeJsonFile(`probe_${id}.json`, data);
    
    console.log(`Deep probe complete. Data saved to probe_${id}.json`);
    
    // Quick preview of the cards
    const commanders = data.cards.filter(card => card.categories.includes("Commander"));
    console.log(`Found ${commanders.length} card(s) categorized as 'Commander'.`);
    
  } catch (error) {
    console.error("Probe failed:", error.message);
  }
}

probeDeck(deckId);