require('dotenv').config({ path: '../.env' }); // Load environment variables from .env
const { Pool } = require('pg');
const fs = require('fs');

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
    
    // Save to a file so we can inspect the exact structure of 'commanders'
    fs.writeFileSync(`./decks/probe_${id}.json`, JSON.stringify(data, null, 2));
    
    console.log("Deep probe complete. Data saved to probe_" + id + ".json");
    
    // Quick preview of the cards
    const commanders = data.cards.filter(card => card.categories.includes("Commander"));
    console.log(`Found ${commanders.length} card(s) categorized as 'Commander'.`);
    
  } catch (error) {
    console.error("Probe failed:", error.message);
  }
}

probeDeck(deckId);