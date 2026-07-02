-- Seed mapping for tag_category_map. Priority scale (your judgment,
-- adjust freely): 90-100 = unambiguous, strongly defining tags;
-- 50-70 = supporting/secondary signal; below 50 = weak/contextual,
-- only wins if nothing stronger is present on the card.
--
-- Rows marked ASSUMPTION in notes were not explicitly discussed and
-- should be reviewed -- everything else reflects a direct decision
-- from our conversation.

INSERT INTO tag_category_map (tag_slug, card_category, normalized_category, priority, notes) VALUES

-- ===== TARGETED_INT =====
('spot-removal',                  'REMOVAL_SPOT',        'TARGETED_INT', 95, NULL),
('single-target-instant-sorcery', 'REMOVAL_SPOT',        'TARGETED_INT', 40, 'Near-duplicate signal of spot-removal, kept low priority so it does not override more specific removal tags'),
('removal-creature',              'REMOVAL_CREATURE',    'TARGETED_INT', 90, NULL),
('removal-destroy',               'REMOVAL_DESTROY',     'TARGETED_INT', 90, NULL),
('removal-exile',                 'REMOVAL_EXILE',       'TARGETED_INT', 90, NULL),
('removal-bounce',                'REMOVAL_BOUNCE',      'TARGETED_INT', 90, NULL),
('removal-sacrifice',             'REMOVAL_EDICT',       'TARGETED_INT', 90, NULL),
('removal-artifact',              'REMOVAL_ARTIFACT',    'TARGETED_INT', 85, NULL),
('removal-land',                  'REMOVAL_LAND',        'TARGETED_INT', 85, NULL),
('removal-toughness',             'REMOVAL_TOUGHNESS',   'TARGETED_INT', 80, 'Minus-toughness / shrink effects, softer removal'),
('removal-nonland',               'REMOVAL_NONLAND',     'TARGETED_INT', 70, 'Broad catch-all, lower priority than specific removal types'),
('burn-creature',                 'BURN_CREATURE',       'TARGETED_INT', 85, NULL),
('burn-planeswalker',             'BURN_PLANESWALKER',   'TARGETED_INT', 85, NULL),
('burn-any',                      'BURN_FLEXIBLE',       'TARGETED_INT', 85, NULL),
('burn-player',                   'BURN_PLAYER',         'TARGETED_INT', 60, 'Direct damage to opponent -- reach/wincon-adjacent but kept here since it is still a targeted interaction effect'),
('protects-creature',             'PROTECTION',          'TARGETED_INT', 80, 'Per your framing: protection is functionally akin to countering removal aimed at you'),
('damage-prevention',             'PROTECTION_PREVENT',  'TARGETED_INT', 75, NULL),
('hate-attacker',                 'COMBAT_HATE',         'TARGETED_INT', 55, NULL),
('hate-blocker',                  'COMBAT_HATE',         'TARGETED_INT', 55, NULL),

-- ===== MASS_INT =====
('sweeper',                       'BOARD_WIPE',          'MASS_INT',     95, NULL),
('multi-removal',                 'REMOVAL_MULTI',       'MASS_INT',     80, NULL),
('repeatable-removal',            'REMOVAL_REPEATABLE',  'MASS_INT',     60, 'Can be single-target-repeatable rather than true mass removal -- verify per card if precision matters'),

-- ===== RAMP =====
('ramp',                          'RAMP_GENERIC',        'RAMP',         90, NULL),
('land-ramp',                     'LAND_RAMP',           'RAMP',         90, NULL),
('mana-dork',                     'MANA_DORK',           'RAMP',         95, NULL),
('mana-rock',                     'MANA_ROCK',           'RAMP',         95, 'Not in top-150 by count but confirmed present via Sol Ring sample'),
('adds-multiple-mana',            'MANA_MULTI',          'RAMP',         50, 'Weak/support signal -- also appears on combo-mana-sink cards, not purely ramp'),

-- ===== CARD_DRAW (includes tutors/recursion per your call) =====
('draw-engine',                   'DRAW_ENGINE',         'CARD_DRAW',    90, NULL),
('repeatable-pure-draw',          'DRAW_ENGINE',         'CARD_DRAW',    90, NULL),
('pure-draw',                     'DRAW_SPELL',          'CARD_DRAW',    85, NULL),
('burst-draw',                    'DRAW_BURST',          'CARD_DRAW',    80, NULL),
('cantrip',                       'CANTRIP',             'CARD_DRAW',    70, 'Secondary upside on a spell, lower priority than dedicated draw'),
('tutor-to-hand',                 'TUTOR',               'CARD_DRAW',    90, 'Per your call: tutors are specific card draw'),
('tutor-land-basic',              'TUTOR_LAND',          'CARD_DRAW',    85, NULL),
('reanimate-creature',            'RECURSION_CREATURE',  'CARD_DRAW',    80, 'ASSUMPTION: extended tutor logic to recursion (graveyard-to-battlefield tutoring) -- confirm this fits your intent'),
('regrowth-creature',             'RECURSION_SPELL',     'CARD_DRAW',    80, 'ASSUMPTION: same extension as reanimate-creature -- confirm'),

-- ===== SYNERGY =====
('synergy-artifact',              'SYN_ARTIFACT',        'SYNERGY',      85, NULL),
('synergy-instant',               'SYN_INSTANT',         'SYNERGY',      85, NULL),
('synergy-sorcery',               'SYN_SORCERY',         'SYNERGY',      85, NULL),
('synergy-noncreature',           'SYN_NONCREATURE',     'SYNERGY',      70, NULL),
('counters-matter',               'SYN_COUNTERS',        'SYNERGY',      85, NULL),
('pp-counters-matter',            'SYN_COUNTERS',        'SYNERGY',      85, NULL),
('gains-pp-counters',             'SYN_COUNTERS_GRANT',  'SYNERGY',      75, NULL),
('gives-pp-counters',             'SYN_COUNTERS_GRANT',  'SYNERGY',      75, NULL),
('repeatable-creature-tokens',    'SYN_TOKENS',          'SYNERGY',      85, NULL),
('power-matters',                 'SYN_POWER',           'SYNERGY',      80, NULL),
('mana-value-matters',            'SYN_MANA_VALUE',      'SYNERGY',      75, NULL),
('anthem',                        'SYN_BUFF_STATIC',     'SYNERGY',      75, 'Per your call: power/toughness buffs are Synergy, not Protection'),
('keyword-anthem',                'SYN_BUFF_KEYWORD',    'SYNERGY',      75, NULL),
('power-boost-to-all',            'SYN_BUFF_STATIC',     'SYNERGY',      70, NULL),
('toughness-boost-to-all',        'SYN_BUFF_STATIC',     'SYNERGY',      70, NULL),
('gives-flying',                  'SYN_KEYWORD_GRANT',   'SYNERGY',      65, 'Per your call: most keyword grants are Synergy, not Protection'),
('gives-trample',                 'SYN_KEYWORD_GRANT',   'SYNERGY',      65, NULL),
('gives-first-strike',            'SYN_KEYWORD_GRANT',   'SYNERGY',      65, NULL),
('gives-vigilance',               'SYN_KEYWORD_GRANT',   'SYNERGY',      65, NULL),
('gives-haste',                   'SYN_KEYWORD_GRANT',   'SYNERGY',      65, NULL),
('combat-trick',                  'SYN_COMBAT_TRICK',    'SYNERGY',      55, NULL),
('sacrifice-outlet-creature',     'SYN_SAC_OUTLET',      'SYNERGY',      70, 'ASSUMPTION: sac outlets defaulted to Synergy -- not explicitly confirmed, please review'),
('sacrifice-outlet-artifact',     'SYN_SAC_OUTLET',      'SYNERGY',      70, 'ASSUMPTION: same as above -- please review'),
('repeatable-sacrifice-outlet',   'SYN_SAC_OUTLET',      'SYNERGY',      75, 'ASSUMPTION: same as above -- please review'),
('mana-sink',                     'SYN_MANA_SINK',       'SYNERGY',      60, 'Reclassified from Ramp -- this is a mana payoff, not a mana source'),
('bottomless-mana-sink',          'SYN_MANA_SINK',       'SYNERGY',      65, 'Same reasoning as mana-sink'),

-- ===== SYNERGY (added after cross-checking against 115 real Archidekt
-- decks' user-assigned categories -- these are gaps the oracle-tag-only
-- pass had missed) =====
('evasion',                       'SYN_EVASION',         'SYNERGY',      70, 'High-frequency tag (4566 occurrences) missed in the first pass -- confirmed as a real deckbuilding role via Archidekt category cross-check (41/115 decks use "Evasion")'),
('lifegain',                      'SYN_LIFEGAIN',        'SYNERGY',      70, NULL),
('repeatable-lifegain',           'SYN_LIFEGAIN',        'SYNERGY',      80, NULL),
('mill-self',                     'SYN_MILL',            'SYNERGY',      70, NULL),
('discard',                       'SYN_DISCARD',         'SYNERGY',      65, 'Hand disruption -- could arguably be Targeted Interaction, kept as Synergy since it is usually a repeatable theme piece rather than a one-off answer'),
('discard-outlet',                'SYN_DISCARD',         'SYNERGY',      70, NULL),
('drain-life',                    'SYN_DRAIN',           'SYNERGY',      70, NULL),
('untapper-creature',             'SYN_UNTAP',           'SYNERGY',      65, NULL),
('pinger',                        'SYN_PINGER',          'SYNERGY',      65, NULL),
('copy-creature',                 'SYN_COPY',            'SYNERGY',      70, NULL),
('copy-self',                     'SYN_COPY',            'SYNERGY',      70, NULL),
('repeatable-pp-counters',        'SYN_COUNTERS_GRANT',  'SYNERGY',      75, 'Same family as gains-pp-counters/gives-pp-counters, missed in first pass'),
('repeatable-crime',              'SYN_CRIME',           'SYNERGY',      65, 'Thunder Junction "commit a crime" payoff theme'),
('attack-trigger',                'SYN_ATTACK_TRIGGER',  'SYNERGY',      55, NULL),
('attacking-matters-self',        'SYN_ATTACK_TRIGGER',  'SYNERGY',      55, NULL),
('noncreature-typal',             'SYN_TYPAL',           'SYNERGY',      60, NULL),
('cast-trigger-you',              'SYN_SPELLSLINGER',    'SYNERGY',      60, 'Whenever-you-cast payoff theme'),

-- ===== Additional gaps found via spot-checking uncategorized cards
-- against their real oracle text (not just tag frequency) =====
('gains-flying',                  'SYN_KEYWORD_SELF',    'SYNERGY',      60, 'Distinct tag family from gives-flying: self-buff rather than granting to others'),
('gains-vigilance',               'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('gains-lifelink',                'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('gains-menace',                  'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('gains-trample',                 'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('gains-first-strike',            'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('gains-indestructible',          'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('gains-haste',                   'SYN_KEYWORD_SELF',    'SYNERGY',      60, NULL),
('counterspell-soft',             'COUNTERSPELL',        'TARGETED_INT', 85, 'Counters with a condition/cost attached'),
('counterspell-automatic',        'COUNTERSPELL',        'TARGETED_INT', 90, NULL),
('counterspell-reusable',         'COUNTERSPELL',        'TARGETED_INT', 90, NULL),
('counterspell-creature',         'COUNTERSPELL',        'TARGETED_INT', 90, 'Counters that specifically target creature spells'),
('tapper-creature',               'TAPPER',              'TARGETED_INT', 60, 'Repeatable single-target tap-down, soft disruption'),
('impulse-creature',              'DRAW_IMPULSE',        'CARD_DRAW',    70, 'Exile-and-play-temporarily card advantage'),
('repeatable-impulse',            'DRAW_IMPULSE',        'CARD_DRAW',    75, NULL),
('cost-reducer-creature',         'COST_REDUCTION',      'RAMP',         75, 'Reduces spell costs -- functionally ramp even though no mana is added'),
('recursion-from-exile',          'RECURSION_SPELL',     'CARD_DRAW',    80, 'Same family as reanimate-creature/regrowth-creature'),
('energy-generator',              'SYN_ENERGY',          'SYNERGY',      65, NULL),
('counter-fuel-energy',           'SYN_ENERGY',          'SYNERGY',      65, NULL),

-- ===== Gaps found in second spot-check round (post card_faces dedup fix) =====
('damage-prevention-you',         'PROTECTION_PREVENT',  'TARGETED_INT', 75, 'Same family as damage-prevention, player-targeted variant'),
('pariah',                        'PROTECTION_PREVENT',  'TARGETED_INT', 70, NULL),
('prevent-attack',                'PROTECTION',          'TARGETED_INT', 70, 'Personal protection from being attacked, same family as protects-creature'),
('sift',                          'DRAW_SIFT',           'CARD_DRAW',    65, 'MTG community term for draw-X-discard-Y card selection'),
('scry',                          'DRAW_SELECTION',      'CARD_DRAW',    45, 'Card selection rather than raw advantage, kept lower priority than dedicated draw'),
('affinity-for-land-type',        'COST_REDUCTION',      'RAMP',         75, 'Same family as cost-reducer-creature'),
('gains-mm-counters',             'SYN_COUNTERS_NEG',    'SYNERGY',      75, 'New family: mm = minus/minus counters, distinct from the pp (plus/plus) family already mapped'),
('removes-mm-counters-self',      'SYN_COUNTERS_NEG',    'SYNERGY',      75, NULL),
('gives-menace',                  'SYN_KEYWORD_GRANT',   'SYNERGY',      65, 'Missed variant of the gives-* family'),
('gains-deathtouch',              'SYN_KEYWORD_SELF',    'SYNERGY',      60, 'Missed variant of the gains-* family'),
('discard-to-exile',              'SYN_DISCARD',         'SYNERGY',      65, 'Same family as discard/discard-outlet'),
('force-blocker',                 'COMBAT_HATE',         'TARGETED_INT', 55, 'Same family as hate-attacker/hate-blocker'),
('attacking-matters',             'SYN_ATTACK_TRIGGER',  'SYNERGY',      55, 'Parent of attacking-matters-self, already mapped'),
('opponent-loses-life',           'SYN_DRAIN',           'SYNERGY',      55, 'Same family as drain-life -- life loss without necessarily being damage'),
('hand-positive',                 'DRAW_INCIDENTAL',     'CARD_DRAW',    20, 'Weak/incidental signal -- a side effect descriptor, not a role on its own. Kept very low priority so it only wins when nothing more specific applies'),

-- ===== Stax-related tags, split across Targeted/Mass Interaction per
-- design decision (most stax effects are global/symmetric, hence the
-- lean toward MASS_INT; exceptions noted individually) =====
('mass-land-denial',              'LAND_DENIAL_MASS',    'MASS_INT',     85, NULL),
('cost-increaser',                'TAX_COST_INCREASE',   'MASS_INT',     75, 'Typically a static effect taxing all opponents, not a single target'),
('tax-attack',                    'TAX_ATTACK',          'MASS_INT',     65, 'ASSUMPTION: most "cannot attack you" effects are table-wide, verify per card'),
('silence',                       'SILENCE_EFFECT',      'MASS_INT',     60, 'ASSUMPTION: assumes the archetypal Silence-style all-players effect, verify per card'),
('cast-tax',                      'TAX_CAST',            'MASS_INT',     65, NULL),
('skip-untap-step',               'TAX_SKIP_UNTAP',      'MASS_INT',     60, 'ASSUMPTION: assumes symmetric Winter Orb-style effects, verify per card'),
('tax-block',                     'TAX_BLOCK',           'MASS_INT',     45, 'Low sample size (7), low confidence'),
('exile-with-tax',                'REMOVAL_EXILE_TAX',   'TARGETED_INT', 75, 'Single-target exile with a recast cost attached, not a denial effect'),

-- Reclassified OUT of stax entirely -- these care about YOUR OWN
-- commander tax, not denial of opponents, so they don't belong in
-- Targeted/Mass Interaction at all.
('commander-tax-matters',         'SYN_COMMANDER_TAX',   'SYNERGY',      50, 'ASSUMPTION: reclassified out of stax -- this is a synergy theme (caring about your own commander tax number), not a denial effect. Please review.'),
('commander-tax-evasion',         'COMMANDER_TAX_REDUCE','RAMP',         55, 'ASSUMPTION: reclassified out of stax -- this reduces/bypasses your OWN commander tax, functionally a cost reduction rather than denial. Please review.')

-- Intentionally NOT mapped:
--   cycle-da1-commander-tax -- Scryfall's own set-cycle grouping metadata,
--     same pattern as cycle-cmr-artifact-partner seen earlier -- not a
--     gameplay-relevant tag.
--   tax -- single occurrence, too generic/low-confidence to trust.

ON CONFLICT (tag_slug) DO UPDATE SET
    card_category = EXCLUDED.card_category,
    normalized_category = EXCLUDED.normalized_category,
    priority = EXCLUDED.priority,
    notes = EXCLUDED.notes;

-- NOTE: SYN_WINCON (normalized_category SYNERGY) is a recognized category
-- per the Archidekt "Finisher" cross-check (56/115 decks use it), but has
-- no row here -- there is no single oracle tag that means "this is my
-- deck's finisher," it's subjective and deck-dependent. It will not be
-- auto-assigned by categorize_cards.js. Revisit later as either a manual
-- curation pass or a heuristic (e.g. CMC + power/toughness thresholds).