-- 021_secondary_category_and_core_synergies.sql
-- Two additions to let a user narrow the broad SYNERGY bucket down to
-- their deck's actual theme(s), rather than every SYN_* card (typal,
-- lifegain, drain, sac-outlet, ...) being lumped into one generic
-- "Synergy" pile:
--
-- 1. card_category_secondary / normalized_category_secondary --
--    categorize_cards.js's tag-resolution query already ranks every
--    matching category candidate per card (ROW_NUMBER() over priority
--    DESC, weight_rank DESC) and previously discarded everything but the
--    winner. These two columns persist the runner-up (rn = 2) too, so a
--    SYNERGY card that doesn't match a deck's chosen core synergy has a
--    more specific fallback than "generic card type" when it also has a
--    second, less-dominant categorization (e.g. a card that's primarily
--    SYN_TYPAL but also tags as SYN_LIFEGAIN).
--
-- 2. deck_core_synergies -- deck-scoped, user-chosen set of card_category
--    values (from among the SYN_* categories actually present in that
--    deck) that represent the deck's actual build-around theme(s). A
--    deck can have more than one (e.g. an Aristocrats deck combining
--    Sacrifice + Drain + Tokens is common -- few Commander decks are
--    single-theme). Deliberately a separate table from card_list, same
--    reasoning as deck_card_overrides (migration 009): probe.js/
--    deckSync.js never touch this table, so a re-sync can never wipe a
--    user's chosen core synergies.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_category_secondary TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS normalized_category_secondary VARCHAR(20);

CREATE TABLE IF NOT EXISTS deck_core_synergies (
    deck_id BIGINT NOT NULL REFERENCES commander_decks(archidekt_id) ON DELETE CASCADE,
    card_category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (deck_id, card_category)
);
CREATE INDEX IF NOT EXISTS idx_deck_core_synergies_deck ON deck_core_synergies(deck_id);
