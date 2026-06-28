const path = require('path');
const fs = require('fs');

const JSON_DATA_DIR = path.join(__dirname, '..','src', 'jsonfetchfiles');

// Ensure the directory exists
if (!fs.existsSync(JSON_DATA_DIR)) {
    fs.mkdirSync(JSON_DATA_DIR, { recursive: true });
}

function getFilePath(filename) {
    return path.join(JSON_DATA_DIR, filename);
}

function writeJsonFile(filename, data) {
    fs.writeFileSync(getFilePath(filename), JSON.stringify(data, null, 2));
}

function readJsonFile(filename) {
    return JSON.parse(fs.readFileSync(getFilePath(filename), 'utf8'));
}

module.exports = { writeJsonFile, readJsonFile };