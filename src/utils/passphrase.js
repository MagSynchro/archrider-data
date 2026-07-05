// passphrase.js
// Generates Diceware-style "w-w-w-#" passphrases (three random words plus
// a random 2-digit number, hyphen-separated) for staff account bootstrap
// and password resets/rotation -- see HANDOFF_ADMIN.md. Uses crypto's CSPRNG
// (not Math.random) since these are real credentials, not test data.
const crypto = require('crypto');

// Short, common, unambiguous words -- nothing that's hard to read aloud
// or easily confused when relayed manually (no homophone-prone or
// obscure entries).
const WORDS = [
    'harbor', 'velvet', 'comet', 'ridge', 'maple', 'quartz', 'ember', 'thistle',
    'canyon', 'falcon', 'meadow', 'granite', 'willow', 'copper', 'lantern', 'brook',
    'cedar', 'orbit', 'pepper', 'tundra', 'violet', 'anchor', 'basil', 'clover',
    'dune', 'echo', 'flint', 'glacier', 'harvest', 'indigo', 'jasper', 'kettle',
    'lagoon', 'marble', 'nectar', 'olive', 'pinnacle', 'quill', 'raven', 'sable',
    'timber', 'umber', 'vapor', 'walnut', 'yonder', 'zephyr', 'amber', 'birch',
    'cinder', 'delta', 'ferry', 'grove', 'hollow', 'ivory', 'juniper', 'kestrel',
    'lumen', 'mosaic', 'nimbus', 'onyx', 'plateau', 'quartet', 'ribbon', 'summit'
];

function randomWord() {
    return WORDS[crypto.randomInt(0, WORDS.length)];
}

// e.g. "harbor-velvet-comet-42"
function generatePassphrase() {
    const words = [randomWord(), randomWord(), randomWord()];
    const number = crypto.randomInt(10, 100);
    return `${words.join('-')}-${number}`;
}

module.exports = { generatePassphrase };
