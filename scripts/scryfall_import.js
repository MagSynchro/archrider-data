const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/stream-array.js');
const db = require('../database/db.js');

const dataType = process.argv[2]; 

// MTG power/toughness are often non-numeric ("*", "1+*", "?") for
// variable-stat creatures. Only promote to the numeric companion column
// when the raw value is a clean integer or decimal -- otherwise leave it
// NULL rather than guessing at a value.
function parseCleanNumeric(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
    return Number(trimmed);
}

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
        case 'default_cards':
            await insertDefaultCardsPrintings(items);
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
                INSERT INTO cards (oracle_id, name, layout, cmc_total, mana_cost_total, keywords)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (oracle_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    layout = EXCLUDED.layout,
                    cmc_total = EXCLUDED.cmc_total,
                    mana_cost_total = EXCLUDED.mana_cost_total,
                    keywords = EXCLUDED.keywords
            `, [card.oracle_id, card.name, card.layout, card.cmc, card.mana_cost, card.keywords || null]);
            
            const faces = card.card_faces || [card];
            for (const face of faces) {
                await client.query(`
                    INSERT INTO card_faces (
                        parent_oracle_id, name, mana_cost, cmc, oracle_text, artist, artist_id,
                        image_uris, raw_face_data, produced_mana,
                        power, toughness, power_numeric, toughness_numeric,
                        type_line, loyalty, defense
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    ON CONFLICT (parent_oracle_id, name) DO UPDATE SET
                        mana_cost = EXCLUDED.mana_cost,
                        cmc = EXCLUDED.cmc,
                        oracle_text = EXCLUDED.oracle_text,
                        artist = EXCLUDED.artist,
                        artist_id = EXCLUDED.artist_id,
                        image_uris = EXCLUDED.image_uris,
                        raw_face_data = EXCLUDED.raw_face_data,
                        produced_mana = EXCLUDED.produced_mana,
                        power = EXCLUDED.power,
                        toughness = EXCLUDED.toughness,
                        power_numeric = EXCLUDED.power_numeric,
                        toughness_numeric = EXCLUDED.toughness_numeric,
                        type_line = EXCLUDED.type_line,
                        loyalty = EXCLUDED.loyalty,
                        defense = EXCLUDED.defense
                `, [
                    card.oracle_id,
                    face.name,
                    face.mana_cost,
                    face.cmc,
                    face.oracle_text,
                    face.artist,
                    face.artist_id,
                    face.image_uris,
                    face,
                    face.produced_mana || card.produced_mana || null,
                    face.power ?? null,
                    face.toughness ?? null,
                    parseCleanNumeric(face.power),
                    parseCleanNumeric(face.toughness),
                    face.type_line || card.type_line || null,
                    face.loyalty ?? null,
                    face.defense ?? null
                ]);
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
                    ON CONFLICT (tag_id, oracle_id) DO UPDATE SET weight = EXCLUDED.weight
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

async function insertDefaultCardsPrintings(items) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        for (const printing of items) {
            // default_cards includes tokens, art series, etc. that have no oracle_id.
            // Skip those rather than violating the FK to cards.oracle_id.
            if (!printing.oracle_id) continue;

            await client.query(`
                INSERT INTO card_printings (id, oracle_id, set_code, collector_number, is_foil, raw_printing_data)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                    set_code = EXCLUDED.set_code,
                    collector_number = EXCLUDED.collector_number,
                    is_foil = EXCLUDED.is_foil,
                    raw_printing_data = EXCLUDED.raw_printing_data
            `, [
                printing.id,
                printing.oracle_id,
                printing.set,
                printing.collector_number,
                printing.foil === true, // finishes array is more accurate, but this covers the common case
                printing
            ]);
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