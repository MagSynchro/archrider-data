-- 012_deck_ownership.sql
-- Foundation for the credit system / login-triggered scout flow (see
-- HANDOFF_CREDITS.md) -- that flow needs to know "which decks belong to
-- the logged-in user," which nothing before this migration tracked.
--
-- Nullable and ON DELETE SET NULL on purpose: commander_decks rows are
-- scraped independently of registration (scout.js/probe.js can run
-- against any public username), so plenty of rows will have no owning
-- ArchRider user, and a user being deleted shouldn't cascade-delete
-- deck data that's still valid, publicly-sourced content.
ALTER TABLE commander_decks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_commander_decks_user_id ON commander_decks(user_id);

-- Backfill: link already-scraped decks to any user whose verified
-- Archidekt username matches the deck's owner_username. Safe to re-run --
-- only touches rows that don't already have an owner assigned.
UPDATE commander_decks cd
SET user_id = u.id
FROM users u
WHERE cd.owner_username = u.archidekt_username
  AND cd.user_id IS NULL;
