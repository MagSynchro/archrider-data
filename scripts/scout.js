// scout.js
require('dotenv').config();
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { writeJsonFile } = require('./utils/fileHelper.js');
const { throttledFetch } = require('../src/utils/archidektThrottle.js');
const { upsertDeckList } = require('../src/utils/deckSync.js');
const { PAGE_SIZE } = require('../src/utils/archidektDecks.js');

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
    let nextUrl = `https://archidekt.com/api/decks/v3/?ownerUsername=${user}&deckFormat=3&pageSize=${PAGE_SIZE}`;

    while (nextUrl) {
      console.log(`Fetching: ${nextUrl}`);
      // throttledFetch enforces the minimum spacing itself -- no separate delay needed here.
      const response = await throttledFetch(nextUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allResults.push(...data.results);

      // The API provides the link to the next page
      nextUrl = data.next;
    }

    console.log(`Total decks collected: ${allResults.length}`);

    const parsedData = JSON.parse(JSON.stringify(allResults));
    let deckCount = parsedData.length;
    let realtotal = 0;

    // upsertDeckList also purges commander_decks rows no longer present
    // for this owner (deleted/made non-public since the last scout) --
    // see src/utils/deckSync.js. Safe here because parsedData is the
    // complete list for this owner; the pagination loop above would have
    // thrown before reaching this point on a partial/failed fetch.
    const { results, staleDecks } = await upsertDeckList(parsedData, { ownerUsername: user, force });
    if (staleDecks.length > 0) {
      console.log(`Removed ${staleDecks.length} deck(s) no longer public for ${user}: ${staleDecks.map(d => `${d.name} (${d.archidekt_id})`).join(', ')}`);
    }

    for (const { deck, wasUpdated } of results) {
      try {
        if (!wasUpdated && !force) {
          console.log(`Deck ${deck.id} (${deck.name}) already up-to-date.`);
        } else {
          console.log(`Deck ${deck.id} (${deck.name}) inserted/updated successfully.`);
          realtotal++;
        }

        // Fixed conditional: Evaluates insert/update OR force status correctly inside parentheses
        if (wasUpdated || force) {
          // probe.js runs as its own child process, so it can't share this
          // process's throttledFetch state -- this delay is what actually
          // paces the Archidekt call each spawned probe.js makes.
          await delay(2000);
          await triggerProbe(deck.id);
        }
      } catch (error) {
        console.error(`Error processing deck ${deck.id} (${deck.name}):`, error.message);
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
