const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/stream-array.js');
const db = require('../database/db.js');

const dataType = process.argv[2]; 

if (!dataType) {
    console.error("Usage: node src/scryfall_import.js <data_type>");
    console.error("Examples: oracle_cards, oracle_tags, art_tags");
    process.exit(1);
}

async function runImport() {
    console.log(`Fetching manifest to find: ${dataType}...`);
    
    const response = await fetch('https://api.scryfall.com/bulk-data', {
        headers: { 'User-Agent': 'ArchRider-Data-Tool/1.0', 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`Manifest fetch failed: ${response.status}`);
    
    const manifest = await response.json();
    const targetFile = manifest.data.find(item => item.type === dataType);
    
    if (!targetFile) {
        console.error(`Available types: ${manifest.data.map(d => d.type).join(', ')}`);
        throw new Error(`Could not find type '${dataType}' in manifest.`);
    }
    
    // Ensure the directory exists
    const dir = path.join(__dirname, 'jsonfetchfiles');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const filePath = path.join(dir, `${dataType}.json`);
    
    console.log(`Downloading ${dataType} from ${targetFile.download_uri} to ${filePath}...`);
    const downloadResponse = await fetch(targetFile.download_uri);
    
    if (!downloadResponse.ok) throw new Error(`Download failed: ${downloadResponse.status}`);
    
    await pipeline(downloadResponse.body, fs.createWriteStream(filePath));
    
    console.log("Download complete. Starting ingestion...");
    await processAndIngest(filePath);
}

async function processAndIngest(filePath) {
        const pipelineStream = chain([
        fs.createReadStream(filePath),
        parser(),
        streamArray()
    ]);

    let batch = [];
    let totalProcessed = 0; // Track total cards/items processed
    const BATCH_SIZE = 500;
    
    for await (const { value: item } of pipelineStream) {
        batch.push(item);
        if (batch.length >= BATCH_SIZE) {
            await insertBatch(batch);
            totalProcessed += batch.length;
            console.log(`[${new Date().toLocaleTimeString()}] Progress: ${totalProcessed} items ingested.`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        await insertBatch(batch);
        totalProcessed += batch.length;
        console.log(`Ingestion complete! Total items processed: ${totalProcessed}.`);
    }
}

async function insertBatch(items) {
    // Router: add new types here
    switch (dataType) {
        case 'oracle_cards':
            await insertOracleCards(items);
            break;
        case 'oracle_tags':
            await insertOracleTags(items);
            break;
        default:
            console.log(`Handler not yet implemented for ${dataType}.`);
            break;
    }
}

async function insertOracleCards(cards) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        for (const card of cards) {
            if (!card.oracle_id) continue;
            await client.query(`
                INSERT INTO cards (oracle_id, name, layout, cmc_total, mana_cost_total)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (oracle_id) DO NOTHING
            `, [card.oracle_id, card.name, card.layout, card.cmc, card.mana_cost]);
            
            const faces = card.card_faces || [card];
            for (const face of faces) {
                await client.query(`
                    INSERT INTO card_faces (parent_oracle_id, name, mana_cost, cmc, artist, artist_id, image_uris, raw_face_data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [card.oracle_id, face.name, face.mana_cost, face.cmc, face.artist, face.artist_id, face.image_uris, face]);
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function insertOracleTags(tags) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        for (const tag of tags) {
            // Update: Now including parent_ids
            await client.query(`
                INSERT INTO tags (id, slug, label, parent_ids) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET parent_ids = EXCLUDED.parent_ids
            `, [tag.id, tag.slug, tag.label, tag.parent_ids]);

            for (const mapping of tag.taggings) {
                await client.query(`
                    INSERT INTO card_taggings (tag_id, oracle_id, weight) 
                    VALUES ($1, $2, $3)
                `, [tag.id, mapping.oracle_id, mapping.weight]);
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

runImport().catch(err => {
    console.error("Error during import:", err.message);
});