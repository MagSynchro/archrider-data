// archidektDecks.js
const { throttledFetch } = require('./archidektThrottle.js');

// Archidekt's per-owner deck-listing endpoint ignores the pageSize query
// param entirely -- confirmed by requesting pageSize=25, 50, and 100
// against the same real account and getting exactly 60 results back
// every time. HANDOFF_CREDITS.md originally assumed 50 from a single
// account's observed response and explicitly flagged that as unverified;
// this is that verification, and it failed, so the credit-cost formula
// was overcharging relative to Archidekt's real per-request page size.
// PAGE_SIZE is still passed on every request (Archidekt might start
// honoring it, or the value logged here helps anyone debugging a future
// mismatch), but the true constant it needs to match is 60, not 50. If
// this drifts again -- it's unofficial, undocumented API behavior with
// no contract -- re-derive it the same way: request a few different
// pageSize values against a real multi-page account and see what
// actually comes back.
const PAGE_SIZE = 60;

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

    let nextUrl = `https://archidekt.com/api/decks/v3/?${query}&deckFormat=3&pageSize=${PAGE_SIZE}`;
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

    const response = await throttledFetch(`https://archidekt.com/api/decks/v3/?${query}&deckFormat=3&pageSize=${PAGE_SIZE}`);
    if (!response.ok) throw new Error(`Archidekt lookup failed: ${response.status}`);
    const data = await response.json();
    const firstDeck = (data.results || [])[0];
    if (!firstDeck) return null;

    return { username: firstDeck.owner.username, count: data.count };
}

// Given an authoritative `count` from a page-1 response, this is the one
// place that math happens -- see HANDOFF_CREDITS.md: it's used everywhere
// credit cost is computed from a deck count, and must not be
// duplicated/reimplemented per call site.
function totalPages(count) {
    return Math.ceil(count / PAGE_SIZE);
}

module.exports = { fetchAllDecksForOwner, fetchOwnerInfo, totalPages, PAGE_SIZE };
