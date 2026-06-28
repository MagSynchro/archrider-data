const fs = require('fs');
const { pipeline } = require('stream/promises');

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
}

importScryfallData().catch(err => {
    console.error("Error during import:", err.message);
});