// scout.js
require('dotenv').config();
const fs = require('fs');

// Grab the username from the command line: node scout.js <username>
const username = process.argv[2]; 

if (!username) {
  console.error("Usage: node scout.js <archidekt_username>");
  process.exit(1);
}

async function scoutDecks(user) {
  try {
    console.log(`Initiating reconnaissance for user: ${user}...`);
    
    // Archidekt API endpoint for a specific user's decks
    const url = `https://archidekt.com/api/decks/v3/?ownerUsername=${user}&deckFormat=3`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    fs.writeFileSync(`./decks/decks_${user}.json`, JSON.stringify(data, null, 2));
    console.log(`Recon successful: decks_${user}.json created.`);
    
  } catch (error) {
    console.error("Recon failed:", error.message);
  }
}

scoutDecks(username);