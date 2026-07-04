-- 015_profile_and_credits.sql
-- Backs the new Profile page: registration-status display, deck counts,
-- and a first look at the API credit system (see HANDOFF_CREDITS.md).
--
-- credits_balance/credits_max/tier: only the schema shape from
-- HANDOFF_CREDITS.md is built here (max 10, tier-aware column). The
-- regen job and deduct-then-refund spending logic are NOT part of this
-- migration -- nothing spends credits yet, so there's nothing to protect
-- against spending on. Defaults match the documented free-tier values.
--
-- archidekt_deck_count: cached total public deck count from Archidekt,
-- captured for free at verification time (we already have the full
-- deck list in memory to find the verification match) and refreshed
-- opportunistically at login alongside the username (see
-- authController.js). Nullable -- unknown until the first
-- verify()/login() populates it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_max INTEGER NOT NULL DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS archidekt_deck_count INTEGER;
