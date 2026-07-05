# HANDOFF_STATUS.md

Continuity briefing for picking this project up in a **new conversation
with no memory of prior sessions** — written because the primary
developer is switching to Claude Chat (conversational only, no repo/tool
access) on a different machine this week. This is not a substitute for
the other docs below; it's the "don't re-derive what's already decided"
summary that sits on top of them.

## Read in this order

1. **`CLAUDE.md`** — repo conventions, the card taxonomy design, the
   mana base engine's math and documented simplifications, Archidekt
   data quirks. Written specifically to stop already-settled decisions
   from being re-litigated or silently "fixed" back to a worse state.
2. **`HANDOFF_REGISTRATION.md`**, **`HANDOFF_CREDITS.md`**,
   **`HANDOFF_QUEUE.md`**, **`HANDOFF_ADMIN.md`** — design writeups for,
   respectively: Archidekt-ownership verification at registration, the
   API credit system, the priority-aware Archidekt rate-limit queue, and
   the Owner/Admin/Moderator staff account system.
3. **This file** — what shipped most recently, current running state,
   and what's still open.

## Running the project

- Backend: `node src/index.js` (port 3000, CommonJS). Frontend: `npm
  --prefix client run dev` (port 5173, Vite/ESM, proxies `/api/*` to the
  backend — see `client/vite.config.js`). `.claude/launch.json` has both
  as named configs if using an environment that reads it.
- **`.env` is gitignored — it does not travel with `git pull`.** A fresh
  checkout on a new machine needs its own `.env`, copied from
  `.env.example` and filled in (DB_USER/DB_HOST/DB_NAME/DB_PASSWORD/
  DB_PORT/JWT_SECRET/CLIENT_ORIGIN). **Confirm the new machine can
  actually reach the DB host before assuming this "just works"** — it's
  not on localhost or a public address.
- No migration runner script exists. Migrations are applied by hand,
  e.g.:
  `node -e "require('./database/db.js').pool.query(require('fs').readFileSync('database/migrations/0NN_x.sql','utf8'))"`
- Fresh/empty database: run `database/schema.sql`, then the seed-data
  migrations called out in `CLAUDE.md` (005, 007, 008, 010). An existing
  database just continues applying `database/migrations/*.sql` in order
  past wherever it already is.
- **Latest applied migration: `021_secondary_category_and_core_synergies.sql`.**
  Current tables: `cards`, `card_faces`, `card_printings`,
  `card_taggings`, `tags`, `tag_category_map`, `tag_category_patterns`,
  `commander_decks`, `deck_card_lists`, `deck_card_overrides`,
  `deck_core_synergies`, `mana_base_config`, `pending_registrations`,
  `users`, `staff_accounts`, `staff_actions`.
- Branch: `phase-2----express-backend` (this is the active work branch,
  not `master`). Pushed to `origin` as of this handoff.

## What shipped in the most recent work session

Five commits, `579a3cd..4d93ac4`, in this order:

1. **`579a3cd` — Owner/Admin/Moderator staff account system.**
   `staff_accounts` is a wholly separate entity from `users` (never
   Archidekt-linked). Own session/cookie (`archrider_staff_session`,
   separate from the consumer `archrider_session`), own login at
   `/api/admin/login`. Three roles: **Owner** > **Admin** > **Moderator**.
   Owner exists specifically because Admin used to be able to create/
   delete other Admin accounts (a takeover vector) — now only Owner can
   touch Admin accounts, and **Owner accounts themselves are never
   creatable/deletable/password-resettable through the API at all**,
   bootstrap/DB-script only. Full feature set: ban/unban users, delete
   decks, add/adjust credits, sync/probe a deck on a user's behalf
   (free, priority-queued), reset a user's or a staff member's password,
   audit log (`staff_actions`, snapshots actor name/email so hard-deleted
   accounts still leave a traceable record). Frontend at `/staff`
   (`StaffApp.jsx` → `StaffLoginPage.jsx`/`StaffDashboard.jsx`), entirely
   outside the consumer session gate in `App.jsx`. Three real bootstrap
   accounts exist (`Admin-Shane`, `Mod-Shane`, `Owner-Shane`) — their
   passphrases were delivered once, directly in chat, per explicit
   instruction never to write them to any file; **if they're needed
   again, rotate via the staff dashboard's reset-password action rather
   than trying to recover the originals.**
2. **`0213a67` — removed the unauthenticated cross-user "All Decks"
   view.** The consumer nav's "All Decks (Admin)" link was pre-staff-
   system scaffolding — never actually role-gated, and backed by a
   `GET /api/decks` endpoint with **no auth at all**, so any visitor
   (logged in or not) could browse every user's decks. Removed the nav
   link, the route, the now-orphaned `DeckTable.jsx`, and the backend
   endpoint. Equivalent functionality lives properly gated in the staff
   portal's Decks tab now.
3. **`2712030` — fixed `{C}` (colorless pip) handling in the Karsten
   mana base engine.** It was being silently dropped like generic mana
   ({2}, {X}), making colorless-pip cards (Warping Wail, Null Elemental
   Blast, Zhulodok's `{5}{C}`, etc.) invisible to castability checks
   entirely. Now tracked as its own pip requirement. Confirmed lands
   that produce "any one color" (Command Tower, City of Brass) correctly
   do **not** count as `{C}` sources — verified against real Scryfall
   `produced_mana` data, no code change was needed for that part.
4. **`6e0d57a` — deck-scoped core synergies + secondary category
   taxonomy layer.** The broad `SYNERGY` normalized_category covers ~30
   very different fine-grained categories (typal, lifegain, sac-outlet,
   drain, ...), previously all lumped into one generic "Synergy" group
   per deck regardless of relevance. Added `cards.card_category_secondary`/
   `normalized_category_secondary` (the taxonomy resolution query already
   ranked every candidate category per card and discarded all but the
   winner; now the runner-up is persisted too) and `deck_core_synergies`
   (deck-scoped, multi-select, user-chosen). `DeckDisplayTable.jsx`'s
   ArchRider view gets a checkbox selector; a SYNERGY card matching a
   chosen synergy (via primary *or* secondary category) gets its own
   `"Core Synergy: X"` group, everything else falls back through its
   secondary category then raw card type. No selection made → identical
   to prior behavior.
5. **`4d93ac4` — core synergies as manual override targets.** A card's
   taxonomy-derived category can be real but incomplete for a specific
   deck (e.g. Clement, the Worrywort is `RAMP`/`MANA_DORK` by default,
   but its own ability cares about mana value too). Once a deck has
   designated core synergies, `CardDetailModal.jsx`'s override picker
   offers them directly, so a card can be tagged into a synergy it
   genuinely supports without losing its real classification elsewhere.

All five were manually verified end-to-end against real decks/data (not
just unit-level) before being committed — see each commit message for
the specific decks/cards used. Disposable test accounts were created and
deleted for browser-based verification that needed a logged-in consumer
session; no test data was left behind.

## Known open items (flagged, not fixed — deliberate, not forgotten)

- **`setCardOverride`/`clearCardOverride` (card category overrides) and
  the new `deck_core_synergies` add/remove endpoints have no ownership
  or auth check at all.** Any visitor can currently recategorize or set
  core synergies on any deck. This is a pre-existing gap from before
  this session, not introduced by it — flagged twice now (once when
  building core synergies, again implicitly by not fixing it) as worth
  hardening, deliberately left alone both times to avoid introducing an
  inconsistent security model in one corner of the app while leaving
  sibling endpoints exposed. If this gets addressed, do all of
  `setCardOverride`/`clearCardOverride`/`addCoreSynergy`/
  `removeCoreSynergy` together, not piecemeal.
- **`HANDOFF_ADMIN.md`'s own "explicitly deferred" list** still stands:
  no confirm-dialog component reuse for destructive staff actions (native
  `window.confirm`/`window.prompt` used instead — judged fine for an
  internal tool with a handful of trusted staff), no pagination on the
  audit log (hard-capped at 200 most recent rows), no self-service staff
  password rotation (only admin/owner-triggered resets exist).
- **Mana base engine's documented v1 simplifications** (see
  `src/utils/manaBaseUtils.js` header and `CLAUDE.md`) are unchanged by
  the `{C}` fix: unconditional probability model rather than Karsten's
  conditional-on-lands-drawn refinement, hybrid mana pips count toward
  only the first listed color, no explicit mulligan simulation.
- No specific next task was queued as of this handoff — the last few
  sessions have been reactive to direct requests (staff accounts →
  takeover-risk fix → nav cleanup → Karsten `{C}` fix → core synergies →
  override picker extension), not working off a backlog.

## Working via Claude Chat (no direct repo/tool access)

A few adjustments worth making, since the workflow this project has used
so far (`Read` a file, `Edit` it, restart the server, verify live in a
browser preview, run real DB queries to check results) isn't available:

- **Always ask for the current content of a file before proposing a
  diff.** This codebase has drifted from an outdated working copy more
  than once already (see `CLAUDE.md`'s "process habits" section) — that
  risk is much higher without the ability to read the file directly.
- **For anything touching the mana base math or other numeric logic,
  ask for a quick sanity check against a known case** (e.g. the textbook
  40-card/17-land/7-card-hand ≈ 0.987 figure already documented in
  `CLAUDE.md`) rather than trusting that generated code is correct
  because it reads correctly.
- **Don't guess at current DB state** (row counts, which migrations are
  applied, current category breakdowns) — ask for a query to be run and
  the output pasted back, rather than assuming figures from this doc are
  still current by the time you're reading it.
