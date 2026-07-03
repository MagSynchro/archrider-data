# HANDOFF: Archidekt Account Verification & Registration Flow

Design session summary for Claude Code to pick up and implement. This
covers a decision that was actively steered away from a bad initial
approach — read the "Rejected approach" section before anyone
(human or AI) is tempted to revisit it, the reasoning matters.

## The goal

Users register an ArchRider account and need to prove they actually own
the Archidekt username they're claiming, so ArchRider can restrict
scouting/probing and report access to *their own* deck data — not let
any registered user pull anyone's public Archidekt decks through the
app.

## Constraint that shapes everything here

**Archidekt has no official public API, no OAuth, no developer program.**
Confirmed directly from Archidekt's own staff on their forum (2019):
*"we don't want to have to be held responsible for keeping up with
detailed API documentation... if it ever gets to a point where we're
getting constantly hammered by requests that aren't ours and it's
causing issues, we'll have no choice but to lock down the API
entirely."* What exists is an unofficial, tolerated, undocumented set of
endpoints (`archidekt.com/api/decks/...`) — same ones `scout.js`/
`probe.js` already use. There is no sanctioned mechanism to
"authenticate a user against Archidekt."

## Rejected approach: relaying the user's Archidekt password

Initial idea was to have the user enter their Archidekt username +
password into ArchRider, and have ArchRider's server POST it to
`archidekt.com/api/rest-auth/login/` on their behalf. **Do not build
this.** Reasons, for the record:

1. That endpoint is almost certainly Archidekt's own internal session
   login (the URL shape matches `django-rest-auth`/`dj-rest-auth`, a
   standard Django auth package) — it's what their own frontend calls
   when a real user logs into archidekt.com in a browser, not a
   third-party integration point.
2. Asking users to type their Archidekt password into a site that isn't
   Archidekt is indistinguishable in form from phishing, even done in
   complete good faith — it trains users toward exactly the habit that
   makes real phishing succeed against them later.
3. A breach of ArchRider would then also leak *Archidekt* credentials
   for every registered user — a different, worse category of liability
   than leaking ArchRider's own password hashes.
4. Breaks silently the moment 2FA exists on an account.
5. A server issuing repeated login POSTs on behalf of many different
   accounts looks like credential stuffing to any reasonable fraud
   detection — far more likely to get the whole integration blocked than
   the read-only scraping Archidekt has tacitly tolerated so far.

## Chosen approach: unique registration key as a deck name

No credentials ever touch ArchRider's server. Ownership is proven by
the fact that only the actual account owner can create a deck under
their own username.

### Flow

1. User starts registration on ArchRider: normal account basics (email,
   ArchRider password — hash with bcrypt, matching the pattern already
   used in the e-commerce portfolio project) plus the Archidekt username
   they're claiming.
2. ArchRider generates a unique, random, single-use registration key
   (e.g. a UUID or a long random string — needs to be unguessable, not
   just unique) and stores it server-side against the pending
   registration: `{ key, claimed_username, email, password_hash,
   status: 'pending', expires_at, created_at }`.
3. User is shown the key with instructions: create a **public** deck on
   Archidekt (content doesn't matter, can be empty) named *exactly* that
   key, then return to ArchRider and click Verify.
   - Must be public, not private — private decks don't appear via the
     unauthenticated public deck-listing endpoint, so there'd be nothing
     to check against without credentials. No privacy cost to this: an
     empty/dummy deck reveals nothing sensitive by being public.
4. Verify action calls the public
   `archidekt.com/api/decks/?owner=<username>&ownerexact=true`-style
   endpoint (same one `scout.js` already uses) and checks for a deck
   whose name exactly matches the pending key.
5. Match found → activate the account, bind it to that Archidekt
   username, mark the key `verified`/consumed (must be single-use —
   reject any later verification attempt against an already-consumed
   key, even on retry).
6. No match before `expires_at` → key/pending registration invalidated;
   user restarts and gets a fresh key.

### Why a unique key beats a fixed deck name

A fixed name like "ArchRider Registration Deck" can't disambiguate two
concurrent registration attempts — you wouldn't know which pending
signup a matching deck belongs to. A unique per-attempt key sidesteps
this entirely, and is self-securing without extra logic: only the real
account owner can ever create a deck under their own username, so even
if two different people both claim the same Archidekt username, only
the genuine owner can ever satisfy verification for their own key.

## Open / not yet decided

- **Key lifetime.** No security difference between short (~15-30 min)
  and long (hours) — verification is self-securing regardless. Purely a
  UX call: short keeps the pending-registrations table clean and
  matches normal signup-flow expectations; long is more forgiving of
  interruptions.
- **Cleanup of expired/unconsumed pending registrations** — needs some
  periodic sweep (cron-ish job or just a `WHERE expires_at < NOW()`
  check on next signup attempt for that email/username) so the table
  doesn't accumulate abandoned attempts indefinitely.
- **Post-verification UX nicety**: prompt the user that they're free to
  delete or rename the verification deck on Archidekt afterward, since
  it's done its job. Not required for correctness.
- **Rate limiting ArchRider's own calls to Archidekt's endpoints** —
  given Archidekt's explicit "we'll lock it down if abused" warning,
  this should be designed in from the start (both the verification
  check and the existing `scout.js`/`probe.js` calls), not retrofitted
  later once there's real registered-user volume.
- **The users table itself** hasn't been designed yet beyond what's
  implied here (email, password_hash, linked Archidekt username). Full
  users table + session/auth middleware + deck ownership (`user_id` on
  `commander_decks`) + scoping API responses to the logged-in user are
  all still-open next steps referenced in the earlier categorization/
  overrides handoff — this document only covers the registration/
  verification piece specifically.
