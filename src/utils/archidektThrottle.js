// archidektThrottle.js
// In-process throttle for outbound calls to Archidekt's unofficial API.
// Archidekt has no public API/OAuth/developer program, and their own
// staff have said they'll lock the endpoints down if usage looks like
// abuse (see HANDOFF_REGISTRATION.md). This enforces a minimum spacing
// between successive calls from this process -- intentionally a single
// in-memory gate, not a distributed limiter, since this runs as one
// process on a small VPS. Matches the 2s delay scout.js already uses
// between its own sequential Archidekt requests.
const MIN_INTERVAL_MS = 2000;

let lastCallAt = 0;
let chain = Promise.resolve();

// Queues calls so concurrent callers still end up spaced MIN_INTERVAL_MS
// apart, rather than racing to send everything at once.
function throttledFetch(url, options) {
    const gated = chain.then(async () => {
        const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        lastCallAt = Date.now();
    });
    chain = gated;
    return gated.then(() => fetch(url, options));
}

module.exports = { throttledFetch };
