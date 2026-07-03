# HANDOFF: API Credit System & Login-Triggered Scout Flow

Companion to `HANDOFF_REGISTRATION.md` — that document covers account
registration/ownership verification and is unchanged by this one. This
document covers what came after: how registered users' Archidekt API
access gets metered, and the specific flow that runs on login.

## Core principle: discover cost, don't predict it

Early design considered predicting scout cost from an average
decks-per-user constant. Rejected — real testing against the actual
Archidekt API (a live call against account `moraff`, 80 decks) showed
the response already includes an authoritative `count` field on the
first call, for free, as a side effect of a call that has to happen
anyway. There is no such thing as a free preflight check to estimate
cost, and there doesn't need to be one: the true page count is always
known after the first real call, so cost is discovered incrementally,
never estimated in advance.

Reusable core function needed: given `count` from an Archidekt page-1
response, `totalPages = ceil(count / 50)`. This single function is used
in both places credit cost is computed (see below) — don't duplicate
the math.

Important caveat on the `50`: this is Archidekt's actual observed page
size from a real response, not a guess — but only confirmed against one
account so far. Worth a sanity check against a second real account with
a different deck count before fully relying on it being constant across
all accounts/response types.

Important caveat on sort order: the "skip the prompt if nothing past
page 1 could be new" optimization (below) depends on Archidekt
returning decks sorted newest-`updatedAt`-first. Pass
`orderBy=-updatedAt` explicitly on every scout call rather than relying
on unstated default sort behavior — the earlier real response happened
to look newest-first, but that was observed, not guaranteed, until the
explicit param is used and verified.

## Credit system shape

Two separate systems — don't conflate them, they protect different
things and have different keys:

### Registered-user API credits (protects the general scout/probe budget)

- Max 10, regenerate 1/hour.
- Lives on the user record (or a related table) — not yet designed in
  detail beyond: needs a balance, a max, and something to drive the
  hourly regen (a timestamp of last regen tick, checked by a scheduled
  job, is the simplest approach — an actual cron-style backend timer,
  not a per-request lazy calculation, since credits should accrue even
  if the user isn't actively using the app).
- Tiers (different max/regen rates per paid tier) are explicitly future
  work, hooked to a payment system not yet designed. Build the credit
  fields to be tier-aware in shape (a `tier` column influencing which
  max/regen values apply) without building the tier/payment logic
  itself now.

### Unregistered-user verification checks (protects registration abuse, unrelated to the above)

- Max 5 on first day, regenerate 1/day.
- Keys against the `pending_registration` row itself (see the
  registration handoff), not IP address and not the credit system
  above — this is a completely separate bucket for a completely
  separate action (checking whether the verification-key deck exists),
  not general Archidekt API usage.

## Deduction model: deduct-then-refund-on-failure

Credit exists specifically to protect Archidekt's 30-calls/minute limit
from getting the whole app locked out — that's the actual threat model,
not just "meter usage fairly" for its own sake. Given that, credits
must be deducted before the Archidekt call goes out, refunded if the
call itself fails (network error, Archidekt 5xx, timeout).
Call-first/deduct-on-success was considered and rejected: a burst of
failed/retried calls under that model consumes real rate-limit budget
while charging nothing, which is exactly the failure mode credits exist
to prevent.

## The login-triggered scout flow

Goal: avoid the bad UX of charging a credit just to check "how many
decks do I have," while still protecting the rate limit on this path
specifically, since "free to the user" is not the same guarantee as
"free to Archidekt's rate limit."

### Step 1: cooldown gate (not credit-based)

On login, only actually call Archidekt if the last scout for this user
happened more than some cooldown window ago (exact minutes not yet
decided — 15-30 min range suggested, needs a real decision). Inside the
cooldown, serve cached deck data with no new API call. This is the
mechanism that prevents the free page-1 call from becoming an uncapped
drain (repeated logins, multiple tabs, page refreshes).

### Step 2: free page 1

If outside the cooldown, fetch page 1 with `orderBy=-updatedAt`, no
credit charged. Store/update the account's known total deck `count`
from this response.

### Step 3: decide whether anything needs attention

- `count <= 50` (everything fits on the free page): no prompt needed at
  all. Directly update `commander_decks` for any deck whose Archidekt
  `updatedAt` is newer than the stored last-sync info, and confirm to
  the user (e.g. "Updated N decks since your last visit"). Zero credits
  spent, since the free page fully covers this case.
- `count > 50`: check the boundary card — the last deck on page 1 (deck
  #50). Because the list is sorted newest-first (`orderBy=-updatedAt`),
  this single comparison tells you everything:
  - If deck #50's `updatedAt` is already older than the user's last
    sync → every deck after it (pages 2+) is guaranteed older too
    (sorted list property) → skip the prompt entirely, nothing beyond
    page 1 could possibly need updating. No credits spent, no
    unnecessary prompt.
  - If deck #50's `updatedAt` is still newer than last sync → genuine
    signal that pages 2+ might also contain changes → show the prompt.

### Step 4: the prompt (only reached when genuinely warranted)

```
"Since your last login, Archidekt shows you've made changes to at
least {decksUpdated} decks. We've updated your deck inventory to
reflect their status. Would you like to spend {remainingCredits}
credits to scan the remaining {remainingDecks} decks as well?"
```

`remainingCredits = totalPages - 1` (page 1 was already free).
`remainingDecks = count - 50`.

- Confirm: check the user has enough credits (if not, tell them how
  many they need vs. have, don't silently partial-charge). On success,
  deduct `remainingCredits`, fetch pages 2..totalPages, update
  `commander_decks` for every deck found newer than last sync.
- Decline: leave decks beyond page 1 in an explicit third state — not
  "current," not "not current," but unverified / not checked this
  session. The system genuinely doesn't know their status; the UI
  should never imply confidence it doesn't have. (Exact state-machine
  naming/handling deferred — flagged here so it isn't accidentally
  collapsed into a boolean later.)

## Explicitly deferred, not part of this pass

- Exact cooldown window (minutes) for the free login-scout call.
- Payment/tier integration.
- Scaling considerations past ~20 active users.
- The full current/not-current/unverified state machine for deck
  display — noted above, not designed in detail yet.
