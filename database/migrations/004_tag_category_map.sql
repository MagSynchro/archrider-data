-- card_category holds fine-grained, descriptive classifications (e.g.
-- "REMOVAL_SPOT_EXILE") -- widened from VARCHAR(20) since granular codes
-- outgrow that quickly. normalized_category stays VARCHAR(20): it's the
-- fixed bracket-template set (RAMP, TARGETED_INT, MASS_INT, CARD_DRAW,
-- SYNERGY) and is never expected to grow past a handful of short codes.
ALTER TABLE cards ALTER COLUMN card_category TYPE TEXT;

-- Hand-curated taxonomy: maps a single Scryfall oracle tag slug to one
-- card_category / normalized_category. `priority` is the primary conflict
-- resolution signal (see categorize_cards.js) since `card_taggings.weight`
-- turned out to be ~99.7% the single value "median" across the dataset --
-- not useful as a discriminator on its own. Higher priority wins when a
-- card has multiple mapped tags.
CREATE TABLE IF NOT EXISTS tag_category_map (
    tag_slug TEXT PRIMARY KEY REFERENCES tags(slug) ON DELETE CASCADE,
    card_category TEXT NOT NULL,
    normalized_category VARCHAR(20) NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 50,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_tag_category_map_normalized ON tag_category_map(normalized_category);