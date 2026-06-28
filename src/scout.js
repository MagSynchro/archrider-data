// scout.js
require('dotenv').config({ path: '../.env' }); // Load environment variables from .env
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Grab the username from the command line: node scout.js <username>
const username = process.argv[2];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

if (!username) {
  console.error("Usage: node scout.js <archidekt_username>");
  process.exit(1);
}

async function scoutDecks(user) {
  try {
    console.log(`Initiating reconnaissance for user: ${user}...`);

    let allResults = [];
    // Start with the first page
    let nextUrl = `https://archidekt.com/api/decks/v3/?ownerUsername=${user}&deckFormat=3&pageSize=50`;

    while (nextUrl) {
      console.log(`Fetching: ${nextUrl}`);
      const response = await fetch(nextUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allResults.push(...data.results);

      // The API provides the link to the next page
      nextUrl = data.next;
      await delay(2000); // Delay to avoid rate limiting 
    }

    console.log(`Total decks collected: ${allResults.length}`);

    const parsedData = JSON.parse(JSON.stringify(allResults));
    let deckCount = parsedData.length;
    let realtotal = 0;
    console.log(pool);
    for (const deck of parsedData) {
      // Use parameterized values ($1, $2, etc.) to prevent SQL injection and errors
      const query = `
    INSERT INTO commander_decks 
    (archidekt_id, name, card_count, format_id, color_identity, owner_username, owner_id, edh_bracket, created_at, updated_at, last_synced)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (archidekt_id) DO UPDATE SET
      name = EXCLUDED.name,
      card_count = EXCLUDED.card_count,
      format_id = EXCLUDED.format_id,
      color_identity = EXCLUDED.color_identity,
      owner_username = EXCLUDED.owner_username,
      owner_id = EXCLUDED.owner_id,
      edh_bracket = EXCLUDED.edh_bracket,
      updated_at = EXCLUDED.updated_at,
      last_synced = NOW();
  `;

      const values = [
        deck.id,
        deck.name,
        deck.size,
        deck.deckFormat,
        JSON.stringify(deck.colors),
        deck.owner.username,
        deck.owner.id,
        deck.edhBracket || null, // Assuming this is how it's accessed
        deck.createdAt,
        deck.updatedAt
      ];
      console.log(`Inserting/Updating deck: ${deck.id} (${deck.name})`);
      try {
        await pool.query(query, values);
        realtotal++;
      } catch (error) {
        console.error(`Error inserting deck ${deck.id} (${deck.name}):`, error.message);
        console.error("Full Detail:", error.detail || "No further detail");
      }
    }
    console.log(`Total decks found for user ${user}: ${deckCount}, Real total: ${realtotal}`);

    fs.writeFileSync(`./decks/decks_${user}.json`, JSON.stringify(allResults, null, 2));
    console.log(`Recon successful: decks_${user}.json created.`);

  } catch (error) {
    console.error("Recon failed:", error.message);
  }
}

scoutDecks(username);