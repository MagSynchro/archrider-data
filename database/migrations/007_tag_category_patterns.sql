-- Secondary, lower-priority fallback for tag FAMILIES rather than exact
-- tags. Exists because we've now hit "missed a sibling tag" three times
-- (gives-* vs gains-*, pp-counters vs mm-counters, and the many
-- typal-<creaturetype> variants -- one per creature type, dozens of them).
--
-- Resolution rule (see categorize_cards.js): an exact match in
-- tag_category_map ALWAYS wins over a pattern match. Patterns only apply
-- to tags that have no exact entry -- so a future decision to give one
-- specific typal-X tag its own precise category still overrides the
-- generic fallback without needing to touch this table.
CREATE TABLE IF NOT EXISTS tag_category_patterns (
    pattern TEXT PRIMARY KEY, -- SQL LIKE pattern, e.g. 'typal-%'
    card_category TEXT NOT NULL,
    normalized_category VARCHAR(20) NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 40, -- intentionally lower than most exact-match priorities
    notes TEXT
);

INSERT INTO tag_category_patterns (pattern, card_category, normalized_category, priority, notes) VALUES
('typal-%', 'SYN_TYPAL', 'SYNERGY', 55, 'Per design decision: typal decks just need to know a card is tribal synergy, not which specific tribe')
ON CONFLICT (pattern) DO UPDATE SET
    card_category = EXCLUDED.card_category,
    normalized_category = EXCLUDED.normalized_category,
    priority = EXCLUDED.priority,
    notes = EXCLUDED.notes;