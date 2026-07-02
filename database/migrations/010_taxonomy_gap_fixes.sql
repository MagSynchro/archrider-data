-- 010_taxonomy_gap_fixes.sql
-- Closes gaps found via direct user inspection of the DeckDisplayTable UI
-- -- Arcane Signet, Chrome Mox, and Mox Diamond were all falling through
-- to the type_line fallback bucket despite being unambiguous ramp pieces.
--
-- Root cause: Scryfall splits "plain mana rock" from "mana rock with
-- extra bolted-on mechanics" into two separate tags
-- (mana-rock-with-set-s-mechanic), and gives the entire Mox cycle its
-- own dedicated tag (moxen) rather than the generic mana-rock tag. Our
-- exact-match tag_category_map only had the plain string.

-- Pattern fallback (not another one-off exact match) so any FUTURE
-- mana-rock-* variant Scryfall introduces is caught automatically,
-- same reasoning as the typal-% pattern from migration 007.
INSERT INTO tag_category_patterns (pattern, card_category, normalized_category, priority, notes) VALUES
('mana-rock%', 'MANA_ROCK', 'RAMP', 85, 'Catches mana-rock-with-set-s-mechanic and any future mana-rock-* variant. Found via Arcane Signet falling through to type_line fallback despite being an unambiguous EDH staple.')
ON CONFLICT (pattern) DO UPDATE SET
    card_category = EXCLUDED.card_category,
    normalized_category = EXCLUDED.normalized_category,
    priority = EXCLUDED.priority,
    notes = EXCLUDED.notes;

INSERT INTO tag_category_map (tag_slug, card_category, normalized_category, priority, notes) VALUES
-- The Mox cycle gets its own dedicated tag, not the generic mana-rock one.
('moxen', 'MOX', 'RAMP', 95, 'Chrome Mox, Mox Diamond, etc. -- premier fast mana, unambiguous ramp'),

-- Found in the same spot check: Cursed Totem and Grafdigger's Cage,
-- both symmetric hate effects with no mapping at all yet.
('prevent-activation', 'ABILITY_LOCKDOWN', 'MASS_INT', 65, 'Symmetric activated-ability shutoff (e.g. Cursed Totem) -- affects the whole table, not a single target'),
('hate-activation', 'ABILITY_LOCKDOWN', 'MASS_INT', 65, NULL),
('hate-graveyard-cast', 'GRAVEYARD_HATE', 'MASS_INT', 65, 'Symmetric graveyard hate (e.g. Grafdigger''s Cage) -- affects all players'),
('hate-library-cast', 'GRAVEYARD_HATE', 'MASS_INT', 60, NULL),
('graveyard-seal', 'GRAVEYARD_HATE', 'MASS_INT', 65, NULL),
('prevent-etb', 'GRAVEYARD_HATE', 'MASS_INT', 55, 'ASSUMPTION: grouped with graveyard hate since it appeared alongside those tags on Grafdigger''s Cage specifically -- verify this is the right bucket if it shows up on unrelated cards')
ON CONFLICT (tag_slug) DO UPDATE SET
    card_category = EXCLUDED.card_category,
    normalized_category = EXCLUDED.normalized_category,
    priority = EXCLUDED.priority,
    notes = EXCLUDED.notes;

-- Intentionally NOT mapped: hate-set-mechanic (too generic/vague to
-- assign a single category on its own), symmetrical (a modifier
-- descriptor, same category as other meta/templating tags already
-- excluded throughout the taxonomy).