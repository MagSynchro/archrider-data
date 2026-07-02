-- Adds columns needed for board-presence / combat-math analysis
-- (e.g. "how much power is on the battlefield by turn X").
--
-- Design notes:
-- - power/toughness/loyalty/defense live on card_faces, not cards, because
--   Scryfall allows these to differ per face on transform/modal cards.
-- - power/toughness are stored as VARCHAR because MTG allows non-numeric
--   values ("*", "1+*", "?") for variable-stat creatures.
-- - power_numeric/toughness_numeric are nullable companions populated only
--   when the raw value parses cleanly as a plain integer/decimal. They are
--   intentionally left NULL (not 0, not estimated) for variable-stat cards
--   so aggregate queries don't silently misrepresent unknown values.
-- - keywords lives on cards (not card_faces) because Scryfall defines it as
--   a whole-card property (e.g. Trample, Menace apply to the card, not a
--   specific face).

ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS power VARCHAR(10);
ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS toughness VARCHAR(10);
ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS power_numeric NUMERIC;
ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS toughness_numeric NUMERIC;
ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS type_line TEXT;
ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS loyalty VARCHAR(10);
ALTER TABLE card_faces ADD COLUMN IF NOT EXISTS defense VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_card_faces_power_numeric ON card_faces(power_numeric);
CREATE INDEX IF NOT EXISTS idx_card_faces_toughness_numeric ON card_faces(toughness_numeric);
CREATE INDEX IF NOT EXISTS idx_card_faces_type_line ON card_faces(type_line);

ALTER TABLE cards ADD COLUMN IF NOT EXISTS keywords TEXT[];
CREATE INDEX IF NOT EXISTS idx_cards_keywords ON cards USING GIN (keywords);