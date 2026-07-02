// manaBaseUtils.js
// Hypergeometric probability engine for mana base analysis, based on
// Frank Karsten's published methodology (ChannelFireball/TCGplayer,
// "How Many Colored Mana Sources Do You Need to Consistently Cast Your
// Spells?"). All functions here are pure -- no DB access -- so they can
// be tested in isolation. Callers are responsible for pulling config
// values (mana_base_config table) and deck data and passing them in.
//
// DOCUMENTED V1 SIMPLIFICATIONS (read before extending):
//
// 1. UNCONDITIONAL MODEL. Karsten's 2022-updated methodology defines
//    "consistent" as: P(>=N colored sources by turn M) >= (89+M)%,
//    CONDITIONAL on having drawn at least M total lands by turn M. That
//    conditioning requires a joint/multivariate hypergeometric model
//    (land-of-this-color vs land-of-other-color vs non-land-source vs
//    non-source, drawn together) to do precisely. This v1 implements the
//    simpler, still-standard UNCONDITIONAL form -- P(>=N colored sources
//    by turn M) against a flat target_consistency threshold (default
//    90%, see mana_base_config) -- which is what most public calculators
//    actually implement in practice. The conditional joint model is a
//    documented candidate for a v2 refinement, not implemented here.
//
// 2. HYBRID MANA. A hybrid pip like {B/R} is counted toward only the
//    FIRST listed color (e.g. {B/R} counts as a B pip, not counted for
//    R at all). This under-counts a hybrid card's true castability
//    (either color actually works), so treat hybrid-heavy costs as a
//    conservative/pessimistic estimate. A precise treatment would need
//    "count as a source of X OR Y" logic in the source-counting step,
//    which is a documented v2 candidate.
//
// 3. MULLIGANS. No explicit mulligan strategy is simulated. hand_size
//    (default 7, see mana_base_config) is treated as fixed. Karsten's
//    own conditional model sidesteps needing an explicit mulligan
//    simulation by conditioning on "enough lands drawn"; since v1 here
//    doesn't implement that conditioning, mulligan behavior isn't
//    modeled at all yet.

/**
 * Memoized log-factorial cache. Using log-space avoids overflow/precision
 * loss from computing huge factorials directly (relevant even at
 * Commander's ~99-card scale) -- probabilities are computed as
 * exp(sum of logs) rather than as a ratio of enormous integers.
 */
let logFactorialCache = [0]; // logFactorialCache[0] = log(0!) = 0

function logFactorial(n) {
    if (n < 0) throw new Error(`logFactorial called with negative n: ${n}`);
    while (logFactorialCache.length <= n) {
        const i = logFactorialCache.length;
        logFactorialCache.push(logFactorialCache[i - 1] + Math.log(i));
    }
    return logFactorialCache[n];
}

function logCombination(n, k) {
    if (k < 0 || k > n) return -Infinity; // log(0), i.e. C(n,k) = 0
    return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * P(X = k) for X ~ Hypergeometric(populationSize, successStates, sampleSize)
 */
function hypergeometricPMF(populationSize, successStates, sampleSize, k) {
    const failureStates = populationSize - successStates;
    const logP =
        logCombination(successStates, k) +
        logCombination(failureStates, sampleSize - k) -
        logCombination(populationSize, sampleSize);
    return Math.exp(logP);
}

/**
 * P(X >= minSuccesses) for X ~ Hypergeometric(populationSize, successStates, sampleSize)
 *
 * This is the core primitive: "what's the probability of drawing at
 * least `minSuccesses` cards of a given type, drawing `sampleSize` cards
 * from a `populationSize`-card library containing `successStates` copies
 * of that type."
 *
 * `successStates` is rounded to the nearest integer here. Weighted mana
 * source counts (see countManaSources) are frequently fractional --
 * non-land sources like mana rocks are discounted (e.g. 0.75 of a
 * source) -- but a "3.75-card population" has no unambiguous
 * combinatorial meaning: the classical hypergeometric distribution
 * requires a whole number of actual cards. The fractional weighting is
 * a useful heuristic for comparing/displaying mana base strength, but
 * gets rounded here at the boundary where it enters actual discrete
 * probability math.
 */
function hypergeometricAtLeast(populationSize, successStates, sampleSize, minSuccesses) {
    successStates = Math.round(successStates);

    if (minSuccesses <= 0) return 1;
    if (sampleSize <= 0 || populationSize <= 0) return 0;

    const upperBound = Math.min(successStates, sampleSize);
    if (minSuccesses > upperBound) return 0;

    let total = 0;
    for (let k = minSuccesses; k <= upperBound; k++) {
        total += hypergeometricPMF(populationSize, successStates, sampleSize, k);
    }
    // Clamp for floating point drift (e.g. 1.0000000000000002)
    return Math.min(1, Math.max(0, total));
}

/**
 * Number of cards seen by the start of a given turn's main phase, for a
 * Commander game. Commander-specific rule (confirmed against comprehensive
 * rules 103.7c): in multiplayer (3+ player) games, EVERY player draws on
 * their first turn, including the starting player -- unlike standard
 * 2-player Magic, where the starting player skips their turn-1 draw.
 * 1v1 Commander follows the normal 2-player rule.
 *
 * @param {number} turn - the turn number (1-indexed)
 * @param {object} options
 * @param {number} options.handSize - opening hand size, default 7
 * @param {boolean} options.isMultiplayer - default true (the typical Commander pod)
 * @param {boolean} options.isStartingPlayer - only relevant if !isMultiplayer
 */
function cardsSeenByTurn(turn, { handSize = 7, isMultiplayer = true, isStartingPlayer = true } = {}) {
    if (turn < 1) throw new Error(`turn must be >= 1, got ${turn}`);

    if (isMultiplayer) {
        // Every player draws every turn, including turn 1.
        return handSize + turn;
    }

    // 1v1: starting player skips their turn-1 draw only.
    const skippedDraws = isStartingPlayer ? 1 : 0;
    return handSize + turn - skippedDraws;
}

/**
 * Probability that a mana base can cast a spell needing `pipsNeeded`
 * sources of a color by `turn`, given `sourceCount` weighted sources of
 * that color in a `librarySize`-card library (library = deck minus
 * command zone, i.e. 99 for a single-commander deck).
 */
function probabilityOfSources({
    librarySize,
    sourceCount,
    turn,
    pipsNeeded,
    handSize = 7,
    isMultiplayer = true,
    isStartingPlayer = true
}) {
    const sampleSize = cardsSeenByTurn(turn, { handSize, isMultiplayer, isStartingPlayer });
    return hypergeometricAtLeast(librarySize, sourceCount, sampleSize, pipsNeeded);
}

/**
 * Inverse problem: the minimum number of weighted sources needed to hit
 * `targetConsistency` for a given turn/pip requirement. Solved by linear
 * search rather than a closed-form inversion -- library sizes here are
 * small enough (~99) that this is cheap and avoids any risk of an
 * incorrect algebraic inversion of the hypergeometric CDF.
 */
function minimumSourcesNeeded({
    librarySize,
    turn,
    pipsNeeded,
    targetConsistency = 0.9,
    handSize = 7,
    isMultiplayer = true,
    isStartingPlayer = true
}) {
    for (let sources = pipsNeeded; sources <= librarySize; sources++) {
        const probability = probabilityOfSources({
            librarySize,
            sourceCount: sources,
            turn,
            pipsNeeded,
            handSize,
            isMultiplayer,
            isStartingPlayer
        });
        if (probability >= targetConsistency) {
            return { sourcesNeeded: sources, probability };
        }
    }
    // Even a maximal mana base (every remaining card is a source) can't
    // hit the target -- e.g. asking for too many pips too early.
    return { sourcesNeeded: null, probability: null };
}

/**
 * Parses a Scryfall-style mana cost string (e.g. "{2}{G}{G}") into pip
 * counts per color. See module header for the documented hybrid-mana
 * simplification (counts toward the first listed color only).
 */
function getPipRequirements(manaCost) {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    if (!manaCost) return pips;

    const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
    for (const raw of symbols) {
        const symbol = raw.slice(1, -1); // strip { }

        if (/^[WUBRG]$/.test(symbol)) {
            pips[symbol]++;
        } else if (symbol.includes('/')) {
            // Hybrid (e.g. "B/R") or Phyrexian (e.g. "B/P") mana.
            // Simplification: count toward the first listed color only.
            const firstColor = symbol.split('/')[0];
            if (/^[WUBRG]$/.test(firstColor)) {
                pips[firstColor]++;
            }
        }
        // Generic numeric symbols ({2}, {X}, etc.) and {C} intentionally
        // contribute no colored pip requirement.
    }

    return pips;
}

/**
 * Weighted mana source counts per color for a decklist. Expects enriched
 * card objects with `type_line`, `produced_mana` (array of color codes,
 * e.g. ["G"]), and `quantity`. Lands count as full sources; non-land
 * producers (rocks, dorks) are discounted by `nonLandWeight` (see
 * mana_base_config.non_land_source_weight) since they're more vulnerable
 * to removal.
 */
function countManaSources(cards, nonLandWeight = 0.75) {
    const sources = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

    for (const card of cards) {
        if (!card.produced_mana || card.produced_mana.length === 0) continue;

        const isLand = Boolean(card.type_line && card.type_line.includes('Land'));
        const weight = (isLand ? 1 : nonLandWeight) * (card.quantity || 1);

        for (const color of card.produced_mana) {
            if (Object.prototype.hasOwnProperty.call(sources, color)) {
                sources[color] += weight;
            }
        }
    }

    return sources;
}

module.exports = {
    hypergeometricAtLeast,
    cardsSeenByTurn,
    probabilityOfSources,
    minimumSourcesNeeded,
    getPipRequirements,
    countManaSources
};