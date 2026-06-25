// scout.js
require('dotenv').config();
const fs = require('fs');

async function scoutDecks() {
  try {
    console.log("Initiating Archidekt reconnaissance via native fetch...");
    
    // Using the native fetch API
    const response = await fetch('https://archidekt.com/api/decks/v3/');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Save the raw JSON data
    fs.writeFileSync('raw_deck_data.json', JSON.stringify(data, null, 2));
    console.log("Reconnaissance successful: raw_deck_data.json created.");
    
  } catch (error) {
    console.error("Recon failed:", error.message);
  }
}

scoutDecks();