-- 009_deck_card_overrides.sql
-- Stores per-deck, per-card manual category overrides. Deliberately a
-- SEPARATE table from deck_card_lists -- probe.js replaces card_list
-- wholesale on every re-sync (ON CONFLICT ... DO UPDATE SET card_list =
-- EXCLUDED.card_list), so anything stored inside that JSONB blob would
-- be silently destroyed the next time a deck is re-probed. This table
-- is never touched by probe.js, so it survives re-syncs automatically --
-- no special-case merge logic needed anywhere.
--
-- Scope: DECK-scoped, not global. An override here changes how a card
-- displays/groups within this one deck's report; it does not touch
-- cards.normalized_category, which remains the shared, automatically
-- derived taxonomy value for the card everywhere else.
--
-- No user_id column yet -- decks aren't user-owned in the schema yet.
-- Once a users table + deck ownership exists, user_id can be resolved
-- via commander_decks rather than duplicated here; add a direct column
-- only if overrides ever need to be attributable independent of deck
-- ownership (e.g. multiple users editing one shared deck).
CREATE TABLE IF NOT EXISTS deck_card_overrides (
    deck_id BIGINT NOT NULL REFERENCES commander_decks(archidekt_id) ON DELETE CASCADE,
    oracle_id UUID NOT NULL REFERENCES cards(oracle_id) ON DELETE CASCADE,
    normalized_category VARCHAR(20) NOT NULL,
    card_category TEXT, -- optional, for users who want to be more specific than the 5 template buckets
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (deck_id, oracle_id)
);
CREATE INDEX IF NOT EXISTS idx_deck_card_overrides_deck ON deck_card_overrides(deck_id);