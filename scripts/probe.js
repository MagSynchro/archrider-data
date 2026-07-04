// probe.js
require('dotenv').config();
const { writeJsonFile } = require('./utils/fileHelper.js');
const { probeDeckById } = require('../src/utils/deckProbe.js');

const deckId = process.argv[2];

if (!deckId) {
  console.error("Usage: node probe.js <deck_id>");
  process.exit(1);
}

const sanitize = (str) => str.replace(/[^a-z0-9]/gi, '_').toLowerCase();

async function probeDeck(id) {
  try {
    console.log(`Probing deck: ${id}...`);
    const data = await probeDeckById(id);
    console.log(`Metadata synced for ${id}.`);
    console.log(`Card list synced for ${id}.`);
    writeJsonFile(`probe_${sanitize(data.name)}_${id}.json`, data);
  } catch (error) {
    console.error("Probe failed:", error.message);
    process.exit(1); // Exit with error so you know it failed
  }
}

probeDeck(deckId);
