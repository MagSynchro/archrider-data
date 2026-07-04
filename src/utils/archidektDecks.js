// archidektDecks.js
const { throttledFetch } = require('./archidektThrottle.js');

// Paginates Archidekt's unofficial per-owner deck-listing endpoint and
// returns the full flat list of results.
//
// Prefers the stable numeric ownerId when known -- it survives the
// owner renaming their username on Archidekt, unlike ownerUsername.
// Falls back to ownerUsername only when no ID is known yet (e.g. a
// brand-new registration attempt, before we've ever resolved the
// account). Once a user's archidekt_user_id is captured at verification
// (see authController.verify), every later lookup for that user should
// go through here with ownerId set, not ownerUsername.
async function fetchAllDecksForOwner({ ownerId, ownerUsername }) {
    if (!ownerId && !ownerUsername) {
        throw new Error('fetchAllDecksForOwner requires ownerId or ownerUsername');
    }

    const query = ownerId
        ? `ownerId=${encodeURIComponent(ownerId)}`
        : `ownerUsername=${encodeURIComponent(ownerUsername)}`;

    let nextUrl = `https://archidekt.com/api/decks/v3/?${query}&deckFormat=3&pageSize=50`;
    const allResults = [];

    while (nextUrl) {
        const response = await throttledFetch(nextUrl);
        if (!response.ok) throw new Error(`Archidekt lookup failed: ${response.status}`);
        const data = await response.json();
        allResults.push(...(data.results || []));
        nextUrl = data.next;
    }

    return allResults;
}

// Single-page lookup, used when all that's needed is the account's
// current owner info (username, total deck count) rather than every
// deck -- owner data is identical across all of an account's decks, so
// page 1 alone is enough. Returns null if the account has no public
// decks at all (nothing to read owner info from).
async function fetchOwnerInfo({ ownerId, ownerUsername }) {
    if (!ownerId && !ownerUsername) {
        throw new Error('fetchOwnerInfo requires ownerId or ownerUsername');
    }

    const query = ownerId
        ? `ownerId=${encodeURIComponent(ownerId)}`
        : `ownerUsername=${encodeURIComponent(ownerUsername)}`;

    const response = await throttledFetch(`https://archidekt.com/api/decks/v3/?${query}&deckFormat=3&pageSize=50`);
    if (!response.ok) throw new Error(`Archidekt lookup failed: ${response.status}`);
    const data = await response.json();
    const firstDeck = (data.results || [])[0];
    if (!firstDeck) return null;

    return { username: firstDeck.owner.username, count: data.count };
}

module.exports = { fetchAllDecksForOwner, fetchOwnerInfo };
