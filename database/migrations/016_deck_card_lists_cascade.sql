-- 016_deck_card_lists_cascade.sql
-- deck_card_lists had no ON DELETE behavior on its FK to commander_decks
-- (defaults to NO ACTION), unlike deck_card_overrides which already
-- cascades. Needed now that scout.js purges commander_decks rows for
-- decks that have been deleted/made non-public on Archidekt (see
-- scout.js) -- without this, that DELETE would fail outright once a
-- purged deck still had a deck_card_lists row referencing it.
ALTER TABLE deck_card_lists DROP CONSTRAINT IF EXISTS deck_card_lists_deck_id_fkey;
ALTER TABLE deck_card_lists
    ADD CONSTRAINT deck_card_lists_deck_id_fkey
    FOREIGN KEY (deck_id) REFERENCES commander_decks(archidekt_id) ON DELETE CASCADE;
