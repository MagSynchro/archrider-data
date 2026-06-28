const fs = require('fs');
const { pipeline } = require('stream/promises');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/stream-array.js');
const db = require('../database/db.js');

async function importScryfallData() {
    console.log("Fetching Scryfall bulk data manifest...");
    
    // Scryfall documentation requires a User-Agent header
    const response = await fetch('https://api.scryfall.com/bulk-data', {
        headers: {
            'User-Agent': 'ArchRider-Data-Tool/1.0',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Request failed with status ${response.status}: ${errorText}`);
    }
    
    const manifest = await response.json();
    
    // Log structure to verify
    if (!manifest.data || !Array.isArray(manifest.data)) {
        console.error("DEBUG: API Response structure:", JSON.stringify(manifest, null, 2));
        throw new Error("API response does not contain a valid 'data' array.");
    }
    
    const oracleData = manifest.data.find(item => item.type === 'oracle_cards');
    
    if (!oracleData) {
        throw new Error("Could not find 'oracle_cards' type in manifest.");
    }
    
    const downloadUrl = oracleData.download_uri;
    console.log(`Found download URL: ${downloadUrl}`);
    
    console.log(`Downloading to scryfall_oracle.json...`);
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) throw new Error(`Download failed: ${downloadResponse.status}`);
    
    await pipeline(downloadResponse.body, fs.createWriteStream('./src/jsonfetchfiles/scryfall_oracle.json'));
    console.log("Download complete.");

    await processAndIngest();
}



async function processAndIngest() {
    console.log("Starting ingestion into Postgres...");

    const pipelineStream = chain([
        fs.createReadStream('./src/jsonfetchfiles/scryfall_oracle.json'),
        parser(),
        streamArray()
    ]);

    let batch = [];
    let totalProcessed = 0;
    const BATCH_SIZE = 500;

    try {
        for await (const { value: card } of pipelineStream) {
            batch.push(card);
            if (batch.length >= BATCH_SIZE) {
                await insertBatch(batch);
                totalProcessed += batch.length;
                console.log(`Progress: ${totalProcessed} cards processed...`);
                batch = [];
            }
        }
        
        // Process final batch
        if (batch.length > 0) {
            await insertBatch(batch);
            totalProcessed += batch.length;
        }
        console.log("Ingestion complete!");
        
    } catch (error) {
        console.error("Error processing stream:", error);
        throw error;
    }
}

async function insertBatch(cards) {
    const client = await db.pool.connect(); 
    try {
        await client.query('BEGIN');
        
        for (const card of cards) {
            if (!card.oracle_id) continue; 

            // Use the pool connection to insert
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
                `, [
                    card.oracle_id, 
                    face.name, 
                    face.mana_cost, 
                    face.cmc, 
                    face.artist, 
                    face.artist_id, 
                    face.image_uris, 
                    face
                ]);
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Batch insert failed, rolling back:", e.message);
        throw e;
    } finally {
        client.release();
    }
}

importScryfallData().catch(err => {
    console.error("Error during import:", err.message);
});