// archidektThrottle.js
// Priority-aware, rate-limited queue for all outbound Archidekt calls.
// Archidekt has no public API/OAuth/developer program, and their own
// staff have said they'll lock the endpoints down if usage looks like
// abuse (see HANDOFF_REGISTRATION.md); we've separately observed them
// rate-limiting after roughly 30-50 calls/minute. As ArchRider moves from
// a single real user toward Friends & Family alpha with several
// concurrent users, a single FIFO delay (the old version of this file)
// isn't enough on its own -- this adds two priority lanes so paid tiers
// get preferential queueing without being able to starve free users out
// of the shared budget entirely.
//
// Global pace: 30 calls/minute project-wide (one call every 2s),
// regardless of how many users are concurrently active -- this is the
// actual Archidekt-facing constraint everything else here is shaped
// around.
//
// Priority lane (paid tiers: pathfinder/banneret/cartographer) is capped
// at 15 dispatches per rolling 60s window. Once that cap is hit, priority
// work waits even if the standard lane is empty -- paid tiers must never
// be able to eclipse free tier's share, even at the cost of some
// otherwise-unused throughput in a quiet minute. Standard lane (free
// tier, and any call with no user/tier context -- CLI scripts,
// registration verification before an account exists) gets whatever of
// the 30/min budget priority isn't using, which is always at least 15.
//
// In-process only, not a distributed limiter -- this runs as one Node
// process on a small VPS, and that's the whole deployment for the
// foreseeable future (see HANDOFF_CREDITS.md's scaling-past-~20-users
// note, still an open question, not this).
const PAID_TIERS = new Set(['pathfinder', 'banneret', 'cartographer']);
// 'staff' isn't a real consumer tier -- it's what admin-initiated
// sync/probe-for-a-user calls (see adminController.js) pass explicitly,
// so staff support actions always get priority-lane treatment regardless
// of the target user's own tier.
function isPriorityTier(tier) {
    return PAID_TIERS.has(tier) || tier === 'staff';
}

// Factory rather than a single hardcoded module-level queue so tests can
// spin up an instance with small, fast constants (e.g. a 1s window
// instead of 60s) to verify the priority-cap logic without waiting real
// minutes -- see the production singleton below for the real numbers.
function createArchidektQueue({ intervalMs = 2000, priorityCapPerWindow = 15, windowMs = 60000, settleMs = 50, fetchImpl = fetch } = {}) {
    const queues = { priority: [], standard: [] };
    let priorityTimestamps = [];
    let pumping = false;

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function pruneTimestamps() {
        const cutoff = Date.now() - windowMs;
        priorityTimestamps = priorityTimestamps.filter(t => t > cutoff);
    }

    async function pump() {
        if (pumping) return;
        pumping = true;
        // Brief settle window on the idle-to-active transition only (not
        // between every dispatch) -- without it, whichever call happens to
        // be enqueued first always wins the very first pick regardless of
        // priority, since JS runs everything up to the first genuine
        // await synchronously. Several users' requests landing within the
        // same tick need this window to all reach their respective lane
        // before that first decision is made.
        await delay(settleMs);
        while (queues.priority.length || queues.standard.length) {
            pruneTimestamps();

            let next;
            if (queues.priority.length && priorityTimestamps.length < priorityCapPerWindow) {
                next = queues.priority.shift();
                priorityTimestamps.push(Date.now());
            } else if (queues.standard.length) {
                next = queues.standard.shift();
            } else {
                // Only priority work is left, but it's at its cap for this
                // window -- wait for the window to free up rather than
                // let priority exceed its allotment.
                await delay(intervalMs);
                continue;
            }

            const startedAt = Date.now();
            try {
                next.resolve(await next.task());
            } catch (err) {
                next.reject(err);
            }
            const remaining = intervalMs - (Date.now() - startedAt);
            if (remaining > 0) await delay(remaining);
        }
        pumping = false;
    }

    function enqueue(lane, task) {
        return new Promise((resolve, reject) => {
            queues[lane].push({ task, resolve, reject });
            pump();
        });
    }

    // tier is optional -- callers with no user context (CLI scripts,
    // pre-account registration checks) fall through to the standard lane,
    // same as a free-tier user.
    function throttledFetch(url, options, { tier } = {}) {
        const lane = isPriorityTier(tier) ? 'priority' : 'standard';
        return enqueue(lane, () => fetchImpl(url, options));
    }

    return { throttledFetch, queues };
}

const defaultQueue = createArchidektQueue({ intervalMs: 2000, priorityCapPerWindow: 15, windowMs: 60000 });

module.exports = {
    throttledFetch: defaultQueue.throttledFetch,
    createArchidektQueue,
    isPriorityTier
};
