# HANDOFF: Archidekt API Priority Queue

Design context for the priority-aware rate limiter in
`src/utils/archidektThrottle.js`, built ahead of Friends & Family alpha
(target: ~7 days out at time of writing).

## Why now

Until this pass, ArchRider had exactly one real user, so a flat 2-second
delay between outbound Archidekt calls (`archidektThrottle.js`'s
original single-lane version) was trivially sufficient. Alpha means
multiple concurrent users exercising credits at the same time, and the
project's tier ladder (see HANDOFF_CREDITS.md / `src/utils/tiers.js`)
already anticipates paid tiers getting some kind of preferential
treatment ("priority API usage" is explicitly called out for
Pathfinder). The queue needed to exist before that became true in
practice, not after.

## The numbers, and why

- **30 calls/minute project-wide** (one call every 2s). This is the
  actual Archidekt-facing constraint -- observed rate limiting kicks in
  somewhere around 30-50 calls/minute, undocumented and unofficial (see
  HANDOFF_REGISTRATION.md). 30 is the conservative choice.
- **15 calls/minute cap on the priority lane** (paid tiers: pathfinder,
  banneret, cartographer). This is a hard ceiling, not a reservation --
  if the priority lane is idle, free tier can use the full 30/min; if
  priority is maxed out, it still can't take more than half the total
  budget even if free tier has nothing queued that minute. The explicit
  design goal: paid users must never be able to eclipse free users, even
  at the cost of some otherwise-unused throughput in a quiet minute.
- **Free tier gets whatever's left** -- always at least 15/min, up to
  the full 30/min when priority isn't using its share.

## Implementation shape

`createArchidektQueue(options)` is a factory, not a single hardcoded
module singleton -- the production export
(`throttledFetch`/`isPriorityTier`) is one instance configured with the
real numbers above, but tests can spin up a separate instance with
tiny, fast constants (e.g. a 500ms window instead of 60s) to verify the
cap/priority logic in seconds rather than waiting real minutes.

Two FIFO queues (`priority`, `standard`). Every dispatch decision:
prefer priority if it hasn't hit its rolling-window cap; otherwise take
from standard; if priority has work but is capped and standard is
empty, wait rather than let priority exceed its allotment.

**Settle window** (default 50ms): when the queue transitions from idle
to active, it waits briefly before making its first dispatch decision.
Without this, JS's synchronous-until-the-first-real-await execution
model means whichever call happened to be enqueued first (not
necessarily higher-priority) always wins the very first pick after an
idle period, regardless of which lane it's in. Several requests can
land in the same event-loop tick (e.g. concurrent users' Express
handlers all reaching `throttledFetch` moments apart); the settle
window gives all of them a chance to reach their respective lane before
the first real decision is made. Discovered via a fast isolated test
(small constants, mocked fetch) before this was wired into anything
real -- the un-settled version very visibly picked whichever caller
happened to be enqueued first, not the higher-priority one.

## tier is read fresh from the DB, not trusted from the JWT

`req.user` (from the session cookie) does not carry `tier`. A tier
upgrade shouldn't require the user to log out and back in to take
effect on queue priority, so `scoutController.js`'s sync/probe handlers
do a small `SELECT tier FROM users WHERE id = $1` before enqueueing,
rather than caching it in the token at login time.

## What still funnels through the standard (free) lane, and why that's correct

- CLI scripts (`scout.js`, `probe.js`) -- no per-request user/tier
  context exists there at all; they're operator-run maintenance tools,
  not something a specific paid user is waiting on.
- Registration verification (`authController.verify`, via
  `findVerificationDeck`) -- there's no account yet at that point (it's
  a *pending* registration), so there's no tier to check. Correct
  behavior: an unverified signup should never jump the queue regardless
  of which tier they'll eventually claim.

## Explicitly deferred, not part of this pass

- No backpressure/queue-depth limit. At Friends & Family scale (a
  handful of users) this isn't expected to matter yet; revisit if queue
  depth or wait times become a real complaint.
- Not a distributed limiter -- in-process only, since this runs as one
  Node process on one small VPS and that's the whole deployment for now
  (same open question HANDOFF_CREDITS.md already flagged: scaling past
  ~20 users).
- The actual regen job, tier upgrade/payment flow, and admin/moderator
  actions are all still unbuilt (see HANDOFF_CREDITS.md and the
  tier/role display pass) -- this queue is ready for paid-tier traffic
  whenever those exist, but nothing assigns a real paid tier to anyone
  yet.
