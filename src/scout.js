// scout.js
require('dotenv').config();
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const db = require('../database/db.js');
const { writeJsonFile } = require('./utils/fileHelper.js');

// Grab the username from the command line: node scout.js <username>
const username = process.argv[2];
const force = process.argv[3] === 'force';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

if (!username) {
  console.error("Usage: node scout.js <archidekt_username> [force]");
  process.exit(1);
}

async function triggerProbe(id) {
  try {
    // Resolve the absolute path to probe.js
    const probePath = path.join(__dirname, 'probe.js');
    console.log(`...Triggering deep probe for ${id} using ${probePath}`);
    
    // Execute using the absolute path
    await execPromise(`node "${probePath}" ${id}`);
  } catch (err) {
    console.error(`Error probing deck ${id}:`, err.message);
  }
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
    
    for (const deck of parsedData) {
      // Use parameterized values ($1, $2, etc.) to prevent SQL injection and errors
      // Adjusted query to safely account for columns that will be updated later by probe.js
      const query = `
        INSERT INTO commander_decks 
        (archidekt_id, name, card_count, format_id, color_identity, owner_username, owner_id, edh_bracket, created_at, updated_at, last_synced)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (archidekt_id) DO UPDATE SET
          name = EXCLUDED.name,
          card_count = EXCLUDED.card_count,
          format_id = EXCLUDED.format_id,      
          owner_username = EXCLUDED.owner_username,
          owner_id = EXCLUDED.owner_id,
          edh_bracket = EXCLUDED.edh_bracket,
          updated_at = EXCLUDED.updated_at,
          last_synced = NOW()
        ${force ? '' : 'WHERE commander_decks.updated_at < EXCLUDED.updated_at'};
      `;

      // Populating the exact order for $1 through $10
      const values = [
        deck.id,
        deck.name,
        deck.size,
        deck.deckFormat,
        null, // color_identity (will be updated by probe.js)
        deck.owner.username,
        deck.owner.id,
        deck.edhBracket || null,
        deck.createdAt,
        deck.updatedAt
      ];
            
      try {
        const result = await db.query(query, values);
        
        if (result.rowCount === 0 && !force) {
          console.log(`Deck ${deck.id} (${deck.name}) already up-to-date.`);
        } else {
          console.log(`Deck ${deck.id} (${deck.name}) inserted/updated successfully.`);
          realtotal++;
        }

        // Fixed conditional: Evaluates insert/update OR force status correctly inside parentheses
        if (result.rowCount > 0 || force) {
          await delay(2000); 
          await triggerProbe(deck.id);
        }

      } catch (error) {
        console.error(`Error inserting deck ${deck.id} (${deck.name}):`, error.message);
        console.error("Full Detail:", error.detail || "No further detail");
      }
    }
    console.log(`Total decks found for user ${user}: ${deckCount}, Real total: ${realtotal}`);

    writeJsonFile(`decks_${user}.json`, allResults);
    console.log(`Recon successful: decks_${user}.json created.`);

  } catch (error) {
    console.error("Recon failed:", error.message);
  }
}

scoutDecks(username);