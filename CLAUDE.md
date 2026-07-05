# CLAUDE.md

Project context for Claude Code sessions on ArchRider Data. Read this
before making changes — several of these are decisions that were arrived
at after hitting real bugs, not arbitrary style preferences.

## What this project is

A data reconnaissance and analysis tool for Commander (EDH) deck-building.
Pulls deck data from Archidekt, enriches it with full Scryfall card data,
classifies every card's functional role via a hand-curated taxonomy, and
computes mana base consistency (Frank Karsten-style hypergeometric
analysis). See `README.md` for setup/pipeline details — this file is
about *how to work in the codebase*, not how to run it.

## Critical: two different module systems in one repo

- `src/`, `scripts/`, `database/` (backend) — **CommonJS** (`require`/
  `module.exports`). Root `package.json` has `"type": "commonjs"`.
- `client/` (frontend) — **ESM** (`import`/`export`). `client/package.json`
  has `"type": "module"`.

Mixing these up produces a real syntax error, not a warning. Always check
which side of the repo you're in before writing `export function` vs
`module.exports = {}`.

## File conventions

- First line of every generated/edited file: a comment with the filename
  (`// filename.js`, `-- filename.sql`, etc.).
- If a file is otherwise sparsely commented, add a short (~10 word)
  description of each function's purpose.
- Prefer editing in place over regenerating a whole file from scratch —
  large components (`DeckDisplayTable.jsx`, `DeckAnalysisModal.jsx`) have
  a lot of working, tested logic that's easy to accidentally regress if
  rewritten wholesale instead of patched.

## Database: schema.sql is the reconciled source of truth

`database/schema.sql` should always reflect the **current full state** —
a fresh install only needs `schema.sql` plus the data-seed migrations
(currently `005`, `007`, `008`, `010` — check each migration's own header
comment, since seed-data migrations are explicitly marked as such).

**Whenever a migration changes structure (new table, new column, new
constraint), reconcile schema.sql in the same session.** This drifted
once already (schema.sql was missing several columns/tables that existed
in already-applied migrations) and caused real confusion. Don't let it
happen again.

**Migrations are append-only once committed.** Do not edit an
already-shipped migration file to fix a mistake or add a gap-fill — write
a new numbered migration instead. Migration files are a historical
record of what actually happened; rewriting one after the fact makes that
record a lie. (Exception: during active same-session development before
anything's been committed/applied, editing in place is fine — this rule
is about not rewriting history after the fact.)

## The card categorization taxonomy

Every card in `cards` gets (where possible) a `card_category`
(fine-grained, e.g. `MANA_ROCK`) and `normalized_category` (one of five
fixed buckets: `RAMP`, `TARGETED_INT`, `MASS_INT`, `CARD_DRAW`,
`SYNERGY`), derived from Scryfall's oracle tagging project — not written
by hand per card.

- `tag_category_map` — exact tag-slug → category, hand-curated, has a
  `priority` column for conflict resolution.
- `tag_category_patterns` — lower-priority `LIKE`-pattern fallback for
  tag *families* (e.g. `mana-rock%`, `typal-%`), so a new sibling variant
  of a known family (Scryfall does this constantly — `mana-rock` vs
  `mana-rock-with-set-s-mechanic`, `gives-flying` vs `gains-flying`) gets
  caught automatically instead of needing another one-off row. Exact
  matches always win over pattern matches for the same tag.
- `card_taggings.weight` is **not** a reliable signal — it's ~99.7% the
  single value `"median"` across the real dataset. `priority` (your
  curated judgment) is the primary conflict-resolution signal; weight
  only breaks ties.
- Run `node scripts/categorize_cards.js` after any change to either
  table — it's a full re-resolution (idempotent, safe to re-run), not
  incremental.
- 100% coverage is not the goal. Many real cards are legitimately vanilla
  with no functional role — `NULL` category is often correct, not a gap.
  Before adding more mappings, use `scripts/utils/categorization_gap_diagnosis.sql`
  to check whether the real bottleneck is "has tags, none mapped" (
  actionable) vs. "no oracle tags at all" (a hard ceiling — Scryfall's
  tagging project is crowdsourced and incomplete, nothing we can do).
- **When a category looks wrong on a real card, check its actual tags
  before assuming the taxonomy logic is broken.** Several "bugs" turned
  out to be genuine sibling-tag-family gaps (see `010_taxonomy_gap_fixes.sql`
  for a worked example: Arcane Signet/Chrome Mox/Mox Diamond were all
  falling through because they carry `mana-rock-with-set-s-mechanic` or
  `moxen`, not the plain `mana-rock` tag that was mapped).

## Secondary category + deck_core_synergies — narrowing the SYNERGY bucket

The broad `SYNERGY` normalized_category covers ~30 very different
fine-grained `card_category` codes (`SYN_TYPAL`, `SYN_LIFEGAIN`,
`SYN_SAC_OUTLET`, `SYN_DRAIN`, ...). Left alone, every one of those gets
lumped into a single "Synergy" group in the deck view, even though most
decks only actually build around one or two of them — the rest are just
incidental synergy-flavored cards that happen to be in the 99.

Two pieces work together to fix this:

- **`cards.card_category_secondary` / `normalized_category_secondary`**
  (migration 021). `categorize_cards.js`'s tag-resolution query already
  ranks *every* matching category candidate per card (`ROW_NUMBER() OVER
  (PARTITION BY oracle_id ORDER BY priority DESC, weight_rank DESC)`) and
  used to discard everything but the winner (`rn = 1`). These columns
  persist the runner-up (`rn = 2`) instead. Candidates are collapsed to
  one row per `(oracle_id, card_category)` *before* ranking, so two
  different tags resolving to the same category never manufacture a fake
  secondary — it's only ever a genuinely different category, or `NULL`.
- **`deck_core_synergies`** (deck_id, card_category) — deck-scoped,
  user-chosen subset of the SYN_* categories actually present in that
  deck, representing its real build-around theme(s). Multiple are
  allowed (most Commander decks aren't single-theme). Same separate-table
  reasoning as `deck_card_overrides` below: never touched by
  `probe.js`/`deckSync.js`, so it survives re-syncs.

`DeckDisplayTable.jsx`'s `getGroupLabel()` uses both: a SYNERGY card
whose `card_category` (or `card_category_secondary`) matches one of the
deck's chosen core synergies gets its own `"Core Synergy: X"` group;
everything else SYNERGY-classified falls back to its own
`card_category_secondary` label, then to a raw card-type bucket. **Check
the secondary against the chosen set too, not just the primary** — a card
whose secondary matches must join the same `"Core Synergy: X"` group, not
land in a bare, confusingly-similar `"X"` group of its own (a real bug
caught during manual testing before this shipped). When a deck hasn't
designated any core synergy, behavior is identical to before this
feature existed — one generic "Synergy" group.

Once a deck has designated core synergies, `CardDetailModal.jsx`'s manual
override picker also offers them directly as override targets (alongside
the 5 broad buckets), so a card whose *taxonomy-derived* category is
something else entirely can still be tagged into a synergy it genuinely
supports. Worked example that motivated this: Clement, the Worrywort is
`RAMP`/`MANA_DORK` by default (its Frogs make mana), but its own ability
cares about mana value (bounces a lesser-MV creature on ETB) — with
`SYN_MANA_VALUE` set as a chosen core synergy, a user can override
Clement directly into that group without losing the RAMP classification
everywhere else the card appears (the override is deck-scoped, same as
any other `deck_card_overrides` row).

## deck_card_overrides — why it's a separate table

`probe.js` replaces `deck_card_lists.card_list` **wholesale** on every
re-sync (`ON CONFLICT ... DO UPDATE SET card_list = EXCLUDED.card_list`).
Anything stored inside that JSONB blob is destroyed on the next probe.
User-facing manual category overrides live in `deck_card_overrides`
instead — a table `probe.js` never touches — specifically so re-syncing
a deck can never silently wipe a user's manual corrections. Don't be
tempted to "simplify" by merging this into `card_list`; that reintroduces
the exact bug this design avoids.

Overrides are deck-scoped, not global: an override changes how a card
displays within one deck's report. It does not touch
`cards.normalized_category`, which stays the shared, automatically
derived value everywhere else.

## Mana base engine (src/utils/manaBaseUtils.js)

Pure functions, zero DB dependency — testable in isolation via
`node -e "..."`, which is how real bugs in this file have been caught
before shipping. Do this before trusting any change to the probability
math:
- Sum of `P(X=k)` across the full support should be ~1.0
- Known textbook case: 40-card deck, 17 lands, 7-card hand →
  `hypergeometricAtLeast(40, 17, 7, 1)` ≈ 0.987

Two non-obvious things already fixed once, don't reintroduce:
- **Fractional source counts must be rounded before entering the
  hypergeometric math.** Non-land mana sources (rocks/dorks) are
  intentionally weighted at less than 1 (`non_land_source_weight` in
  `mana_base_config`, default 0.75), which produces fractional totals.
  `hypergeometricAtLeast` rounds `successStates` internally for exactly
  this reason — a fractional population size has no combinatorial
  meaning, and the log-factorial cache is integer-indexed anyway
  (fractional lookups silently return `undefined` → `NaN`).
- **Commander multiplayer draw rule**: every player, including the
  starting player, draws on turn 1 in a 3+ player game (comprehensive
  rules 103.7c) — unlike standard 2-player Magic. `cardsSeenByTurn()`
  defaults to this (`isMultiplayer: true`). Only 1v1 Commander uses the
  standard skip-first-draw rule.
- Documented, deliberate v1 simplifications (see file header comments):
  unconditional probability model rather than Karsten's more precise
  conditional-on-lands-drawn refinement; hybrid mana pips count toward
  only the first listed color; no explicit mulligan simulation. These
  are known gaps, not oversights — don't silently "fix" them without
  updating the documentation and re-validating against reference numbers.
- **`{C}` (colorless pip) is tracked as its own pip requirement**, separate
  from generic numeric symbols (`{2}`, `{X}`) which still contribute none.
  This was a real bug once (`{C}` was silently dropped like generic mana),
  which made colorless-pip cards invisible to castability checks entirely.
  A land that produces "any one color" (Command Tower, City of Brass) does
  **not** satisfy `{C}` — confirmed against real Scryfall `produced_mana`
  data (those lands list W/U/B/R/G, never `C`), so `countManaSources()`'s
  `C` bucket only fills from genuinely colorless sources (Sol Ring,
  Ancient Tomb, Wastes, etc.) without needing any special-case exclusion.

## Archidekt data quirks

- `color_identity` format from Archidekt's API isn't definitively
  documented — code that consumes it should normalize defensively
  (see `normalizeColor()` in `manaBaseController.js`) rather than assume
  one exact casing/format.
- Archidekt's own per-card `categories` (free-text, user-assigned) are
  unreliable for anything programmatic — inconsistent casing, arbitrary
  personal taxonomies, sometimes empty. Use the derived
  `normalized_category`/`card_category` taxonomy instead; Archidekt
  categories were cross-referenced once during taxonomy design as a
  validation signal, not used as a data source directly.

## Process habits worth keeping

- When editing a file you haven't seen the *current* content of in this
  session, view/read it first rather than editing from memory or an
  earlier paste — this codebase has drifted from an outdated working
  copy more than once.
- For anything involving real numbers (probability math, statistics,
  published reference figures), verify against a known case before
  trusting it — don't assume correctness from code that merely looks
  right.
- Prefer a new migration over editing a shipped one, prefer defensive
  normalization over assuming one exact external data format, prefer
  pattern-fallback rules over one-off exact matches when a tag family is
  clearly going to have future siblings.