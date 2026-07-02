// manaBaseController.js
// Exposes the Karsten-style mana base engine (src/utils/manaBaseUtils.js)
// as a JSON API endpoint. Logic mirrors scripts/mana_base_report.js
// exactly (including the fractional-source-rounding and color-identity
// normalization fixes) but returns structured data instead of console
// output, for consumption by DeckAnalysisModal.jsx.
const db = require('../../database/db.js');
const {
    countManaSources,
    getPipRequirements,
    probabilityOfSources,
    minimumSourcesNeeded
} = require('../utils/manaBaseUtils.js');

async function loadConfig() {
    const { rows } = await db.query('SELECT key, value FROM mana_base_config');
    const config = {};
    for (const row of rows) {
        config[row.key] = parseFloat(row.value); // node-pg returns NUMERIC as a string
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
    if (rows.length === 0) return null;
    return rows[0];
}

async function enrichCards(cardListEntries) {
    const uniqueIds = [...new Set(cardListEntries.map(c => c.oracleID))];

    const { rows } = await db.query(
        `SELECT DISTINCT ON (c.oracle_id)
            c.oracle_id, c.name, cf.type_line, cf.mana_cost, cf.produced_mana
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

// See scripts/mana_base_report.js header comment for why this defensive
// normalization exists -- Archidekt's exact color_identity format isn't
// definitively documented.
function normalizeColor(raw) {
    if (!raw) return null;
    const value = String(raw).trim();
    if (/^[WUBRG]$/i.test(value)) return value.toUpperCase();
    const fullNameMap = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
    return fullNameMap[value.toLowerCase()] || null;
}

const COLOR_NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };

exports.getManaBaseReport = async (req, res) => {
    const { id } = req.params;
    try {
        const config = await loadConfig();
        const deck = await loadDeck(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        const mainboard = deck.card_list.mainboard || [];
        const enriched = await enrichCards(mainboard);
        const commanders = enriched.filter(c => c.isCommander);
        const nonCommanderCards = enriched.filter(c => !c.isCommander);

        const librarySize = nonCommanderCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
        const sources = countManaSources(nonCommanderCards, config.non_land_source_weight);

        const rawColorIdentity = deck.color_identity || [];
        const colorIdentity = [...new Set(rawColorIdentity.map(normalizeColor).filter(Boolean))];
        const colorIdentityWarning =
            rawColorIdentity.length > 0 && colorIdentity.length === 0
                ? `color_identity was present but did not normalize to a known color: ${JSON.stringify(rawColorIdentity)}`
                : null;

        const weightedSources = ['W', 'U', 'B', 'R', 'G', 'C']
            .filter(color => color === 'C' || colorIdentity.includes(color))
            .map(color => ({
                color,
                colorName: COLOR_NAMES[color],
                sources: Math.round((sources[color] ?? 0) * 100) / 100
            }));

        const commanderCastability = commanders.map(commander => {
            const pips = getPipRequirements(commander.manaCost);
            const cmc = commander.customCmc ?? commander.cmc ?? 0;
            const perColor = Object.entries(pips)
                .filter(([, pipCount]) => pipCount > 0)
                .map(([color, pipCount]) => {
                    const probability = probabilityOfSources({
                        librarySize,
                        sourceCount: sources[color] ?? 0,
                        turn: cmc,
                        pipsNeeded: pipCount,
                        handSize: config.hand_size
                    });
                    return {
                        color,
                        colorName: COLOR_NAMES[color],
                        pipsNeeded: pipCount,
                        probability: Math.round(probability * 1000) / 1000,
                        status: probability >= config.target_consistency ? 'OK' : 'LOW'
                    };
                });
            return { name: commander.name, manaCost: commander.manaCost, cmc, perColor };
        });

        const referenceThresholds = colorIdentity.map(color => {
            const colorSources = Math.round((sources[color] ?? 0) * 100) / 100;
            const byTurn = (turnList, pipsNeeded) => turnList.map(turn => {
                const { sourcesNeeded } = minimumSourcesNeeded({
                    librarySize, turn, pipsNeeded,
                    targetConsistency: config.target_consistency,
                    handSize: config.hand_size
                });
                return {
                    turn,
                    sourcesNeeded,
                    status: sourcesNeeded !== null && colorSources >= sourcesNeeded ? 'OK' : 'LOW'
                };
            });
            return {
                color,
                colorName: COLOR_NAMES[color],
                sources: colorSources,
                singlePip: byTurn([1, 2, 3], 1),
                doublePip: byTurn([2, 3, 4], 2)
            };
        });

        res.json({
            deckName: deck.name,
            librarySize,
            config,
            colorIdentityWarning,
            weightedSources,
            commanderCastability,
            referenceThresholds
        });
    } catch (err) {
        console.error('Error generating mana base report:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};