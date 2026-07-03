# HANDOFF: User Category Overrides & Long-Term Account Design

Context for Claude Code to pick up where this design session left off.
This captures both the original problem/thinking and what was actually
decided and built as a result, so nothing needs to be re-derived.

## The problem that started this

Coverage check on `cards.normalized_category`:

```sql
SELECT
    CASE
        WHEN c.normalized_category IS NOT NULL THEN 'categorized'
        WHEN ct.oracle_id IS NULL THEN 'uncategorized - no oracle tags at all'
        ELSE 'uncategorized - has tags, none mapped yet'
    END AS status,
    COUNT(DISTINCT c.oracle_id) AS card_count
FROM cards c
LEFT JOIN card_taggings ct ON ct.oracle_id = c.oracle_id
GROUP BY status
ORDER BY card_count DESC;
```

Result at time of writing:

| Status | Count |
|---|---|
| categorized | 29,139 |
| uncategorized — has tags, none mapped yet | 6,410 |
| uncategorized — no oracle tags at all | 2,684 |

~25% of the card pool uncategorized. The "has tags, none mapped yet"
bucket (6,410) is closeable through more taxonomy curation (same
pattern as before: check `categorize_cards.js`'s unmapped-tags report,
prioritize by frequency, watch for sibling-tag-family gaps — see
`010_taxonomy_gap_fixes.sql` for a worked example). The "no oracle tags
at all" bucket (2,684) is a **hard ceiling** — Scryfall's tagging
project is crowdsourced and incomplete, no amount of taxonomy mapping
on our end fixes a card with zero tags. That bucket is exactly what
motivated the override system below: if the data source can't tell us,
a human looking at the card can.

Query saved at `scripts/utils/categorization_gap_diagnosis.sql`.

## Decision 1: deck-scoped overrides, not global — ALREADY BUILT

When a user manually corrects a card's category, does it fix that one
card everywhere (global), or just how it displays in that one deck's
report (deck-scoped)? Decided: **deck-scoped**. One user's judgment
call on an ambiguous card shouldn't silently rewrite the shared taxonomy
for everyone else.

**Implemented:**
- `database/migrations/009_deck_card_overrides.sql` — new
  `deck_card_overrides` table, keyed on `(deck_id, oracle_id)`.
- `schema.sql` reconciled to match.
- `src/controllers/deckController.js` — `GET /api/decks/:id` now
  resolves an override (when present) with priority over the
  auto-derived category; every card in the response carries an
  `isOverridden: true/false` flag. Added `setCardOverride` /
  `clearCardOverride` controller methods.
- `src/routes/deckRoutes.js` —
  `PUT /api/decks/:id/cards/:oracleId/category` and
  `DELETE /api/decks/:id/cards/:oracleId/category`.

Backend is complete and independently testable via `curl` — no
frontend depends on it yet.

## Decision 2: why a separate table, not stored in card_list — ALREADY BUILT (the reasoning matters, don't undo it)

`probe.js` replaces `deck_card_lists.card_list` **wholesale** on every
re-sync (`ON CONFLICT ... DO UPDATE SET card_list = EXCLUDED.card_list`).
Anything stored inside that JSONB blob is destroyed the next time the
deck is re-probed from Archidekt. `deck_card_overrides` is a separate
table that `probe.js` never touches, so overrides survive re-syncs
automatically — no merge/preserve logic needed anywhere. This was the
original worry that started the design conversation ("if the user
updated the deck on Archidekt, and reprobed the deck, it would remove
their changes") — it's fully resolved architecturally, not defensively.

## NOT yet built — the actual next step

**Frontend click-to-categorize UI.** Spec, ready to implement:
- Clicking a card in `DeckDisplayTable.jsx` (currently does nothing —
  only hover-preview exists) should open a small picker: the 5
  `normalized_category` options (`RAMP`, `TARGETED_INT`, `MASS_INT`,
  `CARD_DRAW`, `SYNERGY`) plus a "clear override" action.
- Selecting one → `PUT` to `/api/decks/:id/cards/:oracleId/category`.
  Clearing → `DELETE` to the same path.
- Refetch or optimistically update local state after the call.
- Visually distinguish `isOverridden: true` cards (small badge/dot) so
  users can see at a glance what they've manually adjusted — the API
  already returns this flag, just needs to be rendered.

## Parked idea, not committed — Archidekt category toggle

Raised as a possible quick win: a **display-only** toggle in
`DeckDisplayTable.jsx` to switch grouping between our taxonomy and
Archidekt's raw per-card `categories` (already present in `card_list`,
no schema change needed). Explicitly noted at the time that this only
helps for visual inspection/QA, not for actually closing gaps, since it
has no persistence — the override system was judged more valuable for
the actual goal and took priority. Still a legitimate, cheap idea if
someone wants a fast way to eyeball Archidekt's opinion vs. ours
side-by-side. Not started.

## Long-term / explicitly NOT this session's scope

Raised as direction, not designed in detail yet:
- **Users table + registration path.** The person mentioned having a
  specific idea for how they want registration to work but didn't
  elaborate — **ask before designing this**, don't assume a standard
  email/password flow.
- **Scoping deck reports to the logged-in user's own decks** once auth
  exists.
- **Folder/file-explorer-style deck browsing** (explicitly lightweight —
  the VPS is 2 cores / 4GB RAM / 80GB SSD, keep this in mind for any
  design here; a `folder_path` column or a small `folders` table on top
  of user-owned `commander_decks` is likely sufficient, not a heavier
  solution).

These depend on each other in roughly that order (users → ownership →
scoped queries → folder UI) and weren't designed beyond that ordering.