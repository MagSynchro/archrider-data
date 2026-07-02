-- 008_mana_base_config.sql
-- Config table holding the tunable METHODOLOGY knobs for mana base
-- analysis (Frank Karsten-style hypergeometric consistency calculations).
--
-- Deliberately separate from situational query parameters (turn number,
-- specific pip requirements, multiplayer vs 1v1) -- those are passed as
-- function arguments at call time, not stored here. This table only holds
-- values that represent a PHILOSOPHY/METHODOLOGY choice that might
-- reasonably change if better research emerges (a different pro's numbers,
-- a refined non-land discount factor, etc.), so they can be tuned without
-- a code deploy.
CREATE TABLE IF NOT EXISTS mana_base_config (
    key TEXT PRIMARY KEY,
    value NUMERIC NOT NULL,
    description TEXT
);

INSERT INTO mana_base_config (key, value, description) VALUES
(
    'non_land_source_weight',
    0.75,
    'Weight applied to non-land mana sources (rocks/dorks) relative to a full land source. Per Karsten''s convention: non-lands are more vulnerable to removal and don''t count toward opening-hand land expectations, so they are discounted rather than counted as full sources. Adjust if better research emerges.'
),
(
    'target_consistency',
    0.90,
    'Target probability threshold for "can this mana base consistently cast this card". Karsten''s commonly-cited benchmark is ~90%; his 2022 update uses a mana-value-scaled threshold (89 + CMC%) for the conditional model -- this flat value is used for the simpler unconditional model this tool implements in v1.'
),
(
    'hand_size',
    7,
    'Assumed opening hand size after mulligans, before turn draws. Does not model mulligan strategy explicitly -- see manaBaseUtils.js header comments for the documented v1 simplification.'
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;