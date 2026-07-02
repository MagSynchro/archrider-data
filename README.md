# ArchRider Data

A data reconnaissance and analysis tool for Commander (EDH) deck-building — pulls deck data from Archidekt, enriches it with full Scryfall card data, and classifies every card's functional role (Ramp, Targeted Interaction, Mass Interaction, Card Draw, Synergy) using a hand-curated taxonomy built on Scryfall's oracle tagging project. Built to eventually support per-deck bracket assessment against a Commander build template.

## Stack

- **Backend:** Node.js, Express, PostgreSQL (`pg`)
- **Frontend:** React (Vite), TanStack Table
- **Data sources:** [Archidekt API](https://archidekt.com/) (deck data), [Scryfall bulk data](https://scryfall.com/docs/api/bulk-data) (card rules text, printings, oracle tags)

## Project structure

```
archrider-data/
├── client/                  React frontend (Vite)
│   └── src/
│       ├── components/      DeckTable, ColumnFilter, badges, CardPreview
│       └── utils/           color identity / gradient helpers
├── database/
│   ├── schema.sql           Full current-state schema (fresh installs start here)
│   └── migrations/          Structural history + data seed files (see below)
├── scripts/
│   ├── scout.js             Pulls a user's deck list from Archidekt
│   ├── probe.js             Deep-fetches one deck's full card list + metadata
│   ├── scryfall_import.js   Bulk imports Scryfall data (cards, tags, printings)
│   ├── categorize_cards.js  Resolves card_category/normalized_category from tags
│   └── utils/                Diagnostic/discovery queries used during taxonomy design
└── src/                     Express API (deck endpoints)
```

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` in the project root:

```
DB_USER=
DB_HOST=
DB_NAME=
DB_PASSWORD=
DB_PORT=5432
```

`database/db.js` resolves this `.env` relative to its own file location, so scripts work correctly regardless of which directory you run them from.

### 2. Database

```bash
psql -d your_db_name -f database/schema.sql
```

This creates every table in its current final form — including the `card_category`/`card_faces`/`card_taggings` structure, and the taxonomy tables (`tag_category_map`, `tag_category_patterns`). It's safe to re-run on an existing database (`CREATE TABLE IF NOT EXISTS` throughout).

### 3. Install dependencies

```bash
npm install
cd client && npm install
```

## Data pipeline

Run in this order — each stage depends on the one before it:

```bash
# 1. Scryfall card data (rules text, stats, images)
node scripts/scryfall_import.js oracle_cards

# 2. Scryfall oracle tags (community-tagged mechanics/synergies)
node scripts/scryfall_import.js oracle_tags

# 3. Scryfall printings (art/set-specific data — needs oracle_cards done first, FK dependency)
node scripts/scryfall_import.js default_cards

# 4. Taxonomy seed data — needs tags populated (step 2), so run after, not before
psql -d your_db_name -f database/migrations/005_seed_tag_category_map.sql
psql -d your_db_name -f database/migrations/007_tag_category_patterns.sql

# 5. Resolve card_category / normalized_category from the taxonomy
node scripts/categorize_cards.js

# 6. Pull decks for a given Archidekt user, then deep-fetch each one
node scripts/scout.js <archidekt_username>
node scripts/probe.js <deck_id>   # scout.js triggers this automatically per deck
```

Re-running `oracle_cards`/`oracle_tags`/`default_cards` is safe — all three are idempotent upserts. Re-running `categorize_cards.js` is also safe and expected any time `tag_category_map`/`tag_category_patterns` changes; it's a full re-resolution, not incremental.

## The categorization taxonomy

Every card is (where possible) assigned a `card_category` (fine-grained, e.g. `MANA_DORK`, `REMOVAL_SPOT`, `SYN_TYPAL`) and a `normalized_category` (one of five fixed buckets: `RAMP`, `TARGETED_INT`, `MASS_INT`, `CARD_DRAW`, `SYNERGY`) — intended as the basis for assessing a deck against a Commander bracket template.

This is derived from Scryfall's oracle tagging project, not written by hand per-card:

- **`tag_category_map`** — exact tag-slug → category mappings, hand-curated and prioritized (~123 tags mapped as of this writing). `priority` resolves conflicts when a card has multiple mapped tags; `card_taggings.weight` turned out to be ~99.7% a single value across the whole dataset, so it's not a reliable signal on its own and is only used as a tiebreaker.
- **`tag_category_patterns`** — lower-priority `LIKE`-pattern fallback for tag *families* (e.g. `typal-%` → `SYN_TYPAL`), so a new variant of a known family doesn't require a manual mapping row every time Scryfall adds one. Exact matches in `tag_category_map` always win over a pattern match for the same tag.

Coverage isn't expected to reach 100% — many real cards are legitimately vanilla with no functional role, and that's correctly represented as `NULL`, not a gap.

Known open items, documented inline in `005_seed_tag_category_map.sql`:
- **`SYN_WINCON`** ("Finisher") — recognized as a real category via cross-checking against real Archidekt deck data, but has no single underlying Scryfall tag (it's deck-dependent/subjective). Not auto-assigned; would need manual curation or a future heuristic.
- **`group-hug`** — a real archetype descriptor, but describes strategy rather than a card's functional role, so it's intentionally out of scope for this taxonomy.

## Database migrations

`database/schema.sql` is the current full-state source of truth for a fresh install. `database/migrations/` holds the incremental history:

| # | Structural or data? | Still needed on a fresh install? |
|---|---|---|
| 001–004, 006 | Structural (columns, constraints) | No — already reflected in `schema.sql` |
| 005 | **Data** — the taxonomy mapping itself | **Yes** — run after `oracle_tags` import |
| 007 | **Data** — the pattern fallback rules | **Yes** — no data dependency, safe anytime after `schema.sql` |

Kept for history rather than deleted: `003` and `006` each document a real bug (duplicate rows from non-idempotent re-imports, caught via data spot-checks rather than assumed) and its fix.

## Known limitations / next steps

- `deckController.js` enriches deck card lists with card *names* only — not images, since `card_printings` (populated by `default_cards`) isn't joined in yet. Needed for `CardPreview.jsx` to show real per-printing art rather than a generic placeholder.
- Frontend deploy to production is currently manual SFTP + a hand-managed `pm2` process — no CI/CD yet.
- Bracket-assessment logic itself (scoring a decklist against `normalized_category` distribution) isn't built yet — this taxonomy is the foundation for it, not the feature itself.