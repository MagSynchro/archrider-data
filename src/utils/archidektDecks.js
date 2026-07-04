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

    let nextUrl = `https://archidekt.com/api/decks/v3/?${query}&pageSize=50`;
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

module.exports = { fetchAllDecksForOwner };
