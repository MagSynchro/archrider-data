// mana_base_report.js
// Runs the Karsten-style mana base engine against one real stored deck
// and prints a report: per-color weighted source counts, the commander's
// own castability on curve, and reference single/double-pip thresholds
// per color. Usage: node scripts/mana_base_report.js <archidekt_deck_id>
require('dotenv').config();
const db = require('../database/db.js');
const {
    countManaSources,
    getPipRequirements,
    probabilityOfSources,
    minimumSourcesNeeded
} = require('../src/utils/manaBaseUtils.js');

const deckId = process.argv[2];

if (!deckId) {
    console.error('Usage: node scripts/mana_base_report.js <archidekt_deck_id>');
    process.exit(1);
}

async function loadConfig() {
    const { rows } = await db.query('SELECT key, value FROM mana_base_config');
    const config = {};
    for (const row of rows) {
        // node-pg returns NUMERIC as a string -- parse explicitly.
        config[row.key] = parseFloat(row.value);
    }
    return config;
}

async function loadDeck(id) {
    const { rows } = await db.query(
        `SELECT c.name, c.color_identity, d.card_list
         FROM commander_decks c
         JOIN deck_card_lists d ON c.archidekt_id = d.deck_id
         WHERE c.archidekt_id = $1`,
        [id]
    );
    if (rows.length === 0) throw new Error(`Deck ${id} not found`);
    return rows[0];
}

async function enrichCards(cardListEntries) {
    const uniqueIds = [...new Set(cardListEntries.map(c => c.oracleID))];

    const { rows } = await db.query(
        `SELECT DISTINCT ON (c.oracle_id)
            c.oracle_id, c.name, c.mana_cost_total, cf.type_line, cf.mana_cost, cf.produced_mana
         FROM cards c
         LEFT JOIN card_faces cf ON cf.parent_oracle_id = c.oracle_id
         WHERE c.oracle_id = ANY($1)
         ORDER BY c.oracle_id, cf.id ASC`,
        [uniqueIds]
    );

    const metaMap = rows.reduce((acc, row) => {
        acc[row.oracle_id] = row;
        return acc;
    }, {});

    return cardListEntries.map(c => {
        const meta = metaMap[c.oracleID] || {};
        return {
            ...c,
            name: meta.name || 'Unknown Card',
            type_line: meta.type_line || null,
            manaCost: meta.mana_cost || null,
            produced_mana: meta.produced_mana || []
        };
    });
}

function formatColor(color) {
    return { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }[color] || color;
}

/**
 * Normalizes a color_identity entry to our canonical uppercase single-letter
 * form (W/U/B/R/G). Archidekt's exact casing/format for this field isn't
 * definitively documented, so this defensively handles the plausible
 * variants: correct uppercase single letters, lowercase single letters,
 * and full color names in either case.
 */
function normalizeColor(raw) {
    if (!raw) return null;
    const value = String(raw).trim();

    if (/^[WUBRG]$/i.test(value)) return value.toUpperCase();

    const fullNameMap = {
        white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G'
    };
    return fullNameMap[value.toLowerCase()] || null;
}

async function run() {
    const config = await loadConfig();
    const deck = await loadDeck(deckId);
    const mainboard = deck.card_list.mainboard || [];

    const enriched = await enrichCards(mainboard);
    const commanders = enriched.filter(c => c.isCommander);
    const nonCommanderCards = enriched.filter(c => !c.isCommander);

    const librarySize = nonCommanderCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
    const sources = countManaSources(nonCommanderCards, config.non_land_source_weight);
    const rawColorIdentity = deck.color_identity || [];
    const colorIdentity = [...new Set(rawColorIdentity.map(normalizeColor).filter(Boolean))];

    if (rawColorIdentity.length > 0 && colorIdentity.length === 0) {
        console.warn(`WARNING: color_identity was present (${JSON.stringify(rawColorIdentity)}) but none of it normalized to a known W/U/B/R/G value. Check the raw format against normalizeColor().`);
    }

    console.log(`\n=== Mana Base Report: ${deck.name} ===`);
    console.log(`Library size (excl. commander): ${librarySize}`);
    console.log(`Config: non-land weight=${config.non_land_source_weight}, target consistency=${(config.target_consistency * 100).toFixed(0)}%, hand size=${config.hand_size}\n`);

    console.log('-- Weighted mana sources --');
    for (const color of ['W', 'U', 'B', 'R', 'G', 'C']) {
        if (color === 'C' || colorIdentity.includes(color)) {
            console.log(`  ${formatColor(color)}: ${(sources[color] ?? 0).toFixed(2)}`);
        }
    }

    if (commanders.length > 0) {
        console.log('\n-- Commander castability on curve --');
        for (const commander of commanders) {
            const pips = getPipRequirements(commander.manaCost);
            const cmc = commander.customCmc ?? commander.cmc ?? 0;
            console.log(`\n  ${commander.name} (${commander.manaCost || '?'}, CMC ${cmc})`);

            for (const [color, pipCount] of Object.entries(pips)) {
                if (pipCount === 0) continue;
                const probability = probabilityOfSources({
                    librarySize,
                    sourceCount: sources[color] ?? 0,
                    turn: cmc,
                    pipsNeeded: pipCount,
                    handSize: config.hand_size
                });
                const status = probability >= config.target_consistency ? 'OK' : 'LOW';
                console.log(`    ${formatColor(color)} (need ${pipCount}): ${(probability * 100).toFixed(1)}% by turn ${cmc} [${status}]`);
            }
        }
    }

    console.log('\n-- Reference thresholds (single/double pip by turn) --');
    for (const color of colorIdentity) {
        const colorSources = sources[color] ?? 0;
        console.log(`\n  ${formatColor(color)} (${colorSources.toFixed(2)} sources in deck):`);
        for (const turn of [1, 2, 3]) {
            const single = minimumSourcesNeeded({
                librarySize, turn, pipsNeeded: 1,
                targetConsistency: config.target_consistency, handSize: config.hand_size
            });
            console.log(`    Turn ${turn}, single pip: needs ${single.sourcesNeeded} sources for ${(config.target_consistency * 100).toFixed(0)}% -- you have ${colorSources.toFixed(2)} [${colorSources >= single.sourcesNeeded ? 'OK' : 'LOW'}]`);
        }
        for (const turn of [2, 3, 4]) {
            const double = minimumSourcesNeeded({
                librarySize, turn, pipsNeeded: 2,
                targetConsistency: config.target_consistency, handSize: config.hand_size
            });
            console.log(`    Turn ${turn}, double pip: needs ${double.sourcesNeeded} sources for ${(config.target_consistency * 100).toFixed(0)}% -- you have ${colorSources.toFixed(2)} [${colorSources >= double.sourcesNeeded ? 'OK' : 'LOW'}]`);
        }
    }

    console.log('');
}

run()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error generating mana base report:', err.message);
        process.exit(1);
    });