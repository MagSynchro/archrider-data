-- 017_last_synced_semantics.sql
-- commander_decks.last_synced previously defaulted to CURRENT_TIMESTAMP
-- and was bumped by scout.js's master-list upsert on every run -- which
-- meant it was always approximately "now" and useless as a signal.
--
-- New meaning: last_synced tracks only when THIS specific deck was last
-- fully synced via probe.js (an eventual credit-costing action -- see
-- HANDOFF_CREDITS.md). scout.js's cheap master-list refresh must not
-- touch it. NULL means "never individually synced." UserDeckTable uses
-- updated_at > last_synced (Archidekt's own last-modified timestamp for
-- the deck vs. our last full sync) to show a "needs sync" indicator --
-- see scout.js/probe.js for the write-side of this split.
ALTER TABLE commander_decks ALTER COLUMN last_synced DROP DEFAULT;

-- Backfill from deck_card_lists.last_synced, which has had the correct
-- per-deck-probe-time semantics all along (only ever written by
-- probe.js) -- a more reliable source than commander_decks' own history
-- of scout-touched values. Decks never individually probed (no
-- deck_card_lists row) become NULL.
UPDATE commander_decks cd
SET last_synced = dcl.last_synced
FROM deck_card_lists dcl
WHERE cd.archidekt_id = dcl.deck_id;

UPDATE commander_decks
SET last_synced = NULL
WHERE archidekt_id NOT IN (SELECT deck_id FROM deck_card_lists);
