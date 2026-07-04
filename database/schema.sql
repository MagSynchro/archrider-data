-- ArchRider schema -- current full structure as of the taxonomy work
-- completed in this session (migrations 001-007 reconciled in).
--
-- CONVENTION GOING FORWARD:
--   - Fresh/empty database: run this file, then the seed data files
--     listed at the bottom (005 and 007's INSERT). Nothing else needed.
--   - Existing database already at some prior migration state: continue
--     applying database/migrations/*.sql in numeric order as before --
--     this file is not a substitute for migrations on a live database
--     with existing data, since CREATE TABLE IF NOT EXISTS won't alter
--     already-existing tables.
--   - Whenever a new migration changes structure, reconcile it into this
--     file in the same session so the two never drift again.

-- 1. Table to store commander decks with relevant derived metadata from contents.
CREATE TABLE IF NOT EXISTS commander_decks (
    archidekt_id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    card_count INTEGER,
    format_id INTEGER,
    color_identity JSONB,
    owner_username VARCHAR(100),
    owner_id INTEGER,
    edh_bracket VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_username ON commander_decks(owner_username);
CREATE INDEX IF NOT EXISTS idx_edh_bracket ON commander_decks(edh_bracket);
CREATE INDEX IF NOT EXISTS idx_owner_id ON commander_decks(owner_id);
-- NOTE: production also has "idx_commander_decks_owner_username", a duplicate
-- of idx_owner_username above. Not recreated here on purpose -- see assessment.

-- 2. Parent Table for Cards: Stores the unique Oracle Identity (one record per card)
CREATE TABLE IF NOT EXISTS cards (
    oracle_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    layout VARCHAR(50),
    cmc_total NUMERIC,
    mana_cost_total VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- card_category: fine-grained classification (e.g. "REMOVAL_SPOT_EXILE").
    -- TEXT rather than a fixed width -- granular codes outgrow VARCHAR(20) fast.
    card_category TEXT,
    -- normalized_category: the fixed bracket-template set (RAMP, TARGETED_INT,
    -- MASS_INT, CARD_DRAW, SYNERGY). Stays short and fixed on purpose.
    normalized_category VARCHAR(20),
    keywords TEXT[]
);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
CREATE INDEX IF NOT EXISTS idx_cards_keywords ON cards USING GIN (keywords);

-- 3. Child Table: Stores specific face details (artists, oracle text, images)
CREATE TABLE IF NOT EXISTS card_faces (
    id SERIAL PRIMARY KEY,
    parent_oracle_id UUID REFERENCES cards(oracle_id) ON DELETE CASCADE,
    name VARCHAR(255),
    mana_cost VARCHAR(50),
    cmc NUMERIC,
    oracle_text TEXT,
    artist VARCHAR(255),
    artist_id UUID,
    image_uris JSONB,
    -- Store full face-specific data here for "mirroring"
    raw_face_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    produced_mana TEXT[],
    power VARCHAR(10),
    toughness VARCHAR(10),
    power_numeric NUMERIC,
    toughness_numeric NUMERIC,
    type_line TEXT,
    loyalty VARCHAR(10),
    defense VARCHAR(10),
    -- Prevents re-running the oracle_cards import from silently
    -- duplicating every face row (see migration 006 for the incident).
    CONSTRAINT card_faces_parent_name_unique UNIQUE (parent_oracle_id, name)
);

CREATE INDEX IF NOT EXISTS idx_card_faces_parent ON card_faces(parent_oracle_id);
CREATE INDEX IF NOT EXISTS idx_card_faces_artist_id ON card_faces(artist_id);
CREATE INDEX IF NOT EXISTS idx_card_faces_raw ON card_faces USING GIN (raw_face_data);
CREATE INDEX IF NOT EXISTS idx_card_faces_produced_mana ON card_faces USING GIN (produced_mana);
CREATE INDEX IF NOT EXISTS idx_card_faces_power_numeric ON card_faces(power_numeric);
CREATE INDEX IF NOT EXISTS idx_card_faces_toughness_numeric ON card_faces(toughness_numeric);
CREATE INDEX IF NOT EXISTS idx_card_faces_type_line ON card_faces(type_line);

CREATE TABLE IF NOT EXISTS card_printings (
    id UUID PRIMARY KEY, -- The specific Scryfall ID (the printing)
    oracle_id UUID REFERENCES cards(oracle_id), -- The link to rules
    set_code VARCHAR(10),
    collector_number VARCHAR(10),
    is_foil BOOLEAN,
    -- This table is what you reference when you import a deck
    raw_printing_data JSONB
);
CREATE INDEX IF NOT EXISTS idx_printings_oracle_id ON card_printings(oracle_id);

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE,
    label TEXT,
    parent_ids UUID[]
);
CREATE INDEX IF NOT EXISTS idx_tags_parent_ids ON tags USING GIN (parent_ids);

CREATE TABLE IF NOT EXISTS card_taggings (
    tag_id UUID REFERENCES tags(id),
    oracle_id UUID REFERENCES cards(oracle_id),
    weight TEXT,
    -- Prevents re-running the oracle_tags import from silently
    -- duplicating every tagging row (see migration 003 for the incident).
    CONSTRAINT card_taggings_tag_oracle_unique UNIQUE (tag_id, oracle_id)
);
CREATE INDEX IF NOT EXISTS idx_card_taggings_oracle_id ON card_taggings(oracle_id);
CREATE INDEX IF NOT EXISTS idx_card_taggings_tag_id ON card_taggings(tag_id);

-- ON DELETE CASCADE: scout.js purges commander_decks rows for decks that
-- have been deleted/made non-public on Archidekt, and this row should go
-- with it rather than being left orphaned (see migration 016).
CREATE TABLE IF NOT EXISTS deck_card_lists (
    deck_id BIGINT PRIMARY KEY REFERENCES commander_decks(archidekt_id) ON DELETE CASCADE,
    card_list JSONB NOT NULL,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deck_cards_gin ON deck_card_lists USING GIN (card_list);

-- Hand-curated taxonomy: maps a single Scryfall oracle tag slug to one
-- card_category / normalized_category. `priority` is the primary conflict
-- resolution signal (see scripts/categorize_cards.js) since
-- card_taggings.weight turned out to be ~99.7% the single value "median"
-- across the dataset -- not useful as a discriminator on its own. Higher
-- priority wins when a card has multiple mapped tags.
--
-- Seed data lives separately in database/migrations/005_seed_tag_category_map.sql
-- -- run that after this file to populate the actual mappings.
CREATE TABLE IF NOT EXISTS tag_category_map (
    tag_slug TEXT PRIMARY KEY REFERENCES tags(slug) ON DELETE CASCADE,
    card_category TEXT NOT NULL,
    normalized_category VARCHAR(20) NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 50,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_tag_category_map_normalized ON tag_category_map(normalized_category);

-- Secondary, lower-priority fallback for tag FAMILIES rather than exact
-- tags (e.g. typal-% -> SYN_TYPAL), so future variants of a known family
-- don't require a manual mapping row every time a new one appears. An
-- exact match in tag_category_map always wins over a pattern match.
--
-- Seed data lives separately in database/migrations/007_tag_category_patterns.sql
-- -- run that after this file to populate the typal-% rule.
CREATE TABLE IF NOT EXISTS tag_category_patterns (
    pattern TEXT PRIMARY KEY, -- SQL LIKE pattern, e.g. 'typal-%'
    card_category TEXT NOT NULL,
    normalized_category VARCHAR(20) NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 40,
    notes TEXT
);

-- Tunable methodology knobs for mana base analysis (Karsten-style
-- hypergeometric consistency calculations, see src/utils/manaBaseUtils.js).
-- Seed data lives separately in database/migrations/008_mana_base_config.sql
-- -- run that after this file to populate the actual default values.
CREATE TABLE IF NOT EXISTS mana_base_config (
    key TEXT PRIMARY KEY,
    value NUMERIC NOT NULL,
    description TEXT
);

-- Deck-scoped manual category overrides. Deliberately separate from
-- deck_card_lists -- probe.js replaces card_list wholesale on every
-- re-sync, so anything stored inside that JSONB blob would be destroyed
-- on the next probe. This table is never touched by probe.js, so
-- overrides survive re-syncs automatically. Scope is per-deck, not
-- global: an override changes how a card displays/groups within one
-- deck's report, it does not touch cards.normalized_category itself.
-- No user_id column yet -- see migration 009 for the reasoning.
CREATE TABLE IF NOT EXISTS deck_card_overrides (
    deck_id BIGINT NOT NULL REFERENCES commander_decks(archidekt_id) ON DELETE CASCADE,
    oracle_id UUID NOT NULL REFERENCES cards(oracle_id) ON DELETE CASCADE,
    normalized_category VARCHAR(20) NOT NULL,
    card_category TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (deck_id, oracle_id)
);
CREATE INDEX IF NOT EXISTS idx_deck_card_overrides_deck ON deck_card_overrides(deck_id);

-- Registration + Archidekt ownership verification (see
-- HANDOFF_REGISTRATION.md). No credentials are ever exchanged with
-- Archidekt -- ownership is proven by the user creating a public deck
-- named exactly the single-use registration_key, which only the real
-- account owner can do under their own Archidekt username.
-- archidekt_user_id: the stable numeric Archidekt owner ID, captured at
-- verification time (see authController.verify). archidekt_username
-- stays for display/the initial claim, but is just a cached, potentially
-- stale label going forward -- if a user renames on Archidekt, this ID
-- is what keeps their account from getting orphaned. Nullable because
-- it's only known after a successful verification.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    archidekt_username VARCHAR(100) NOT NULL UNIQUE,
    archidekt_user_id INTEGER UNIQUE,
    -- Cooldown-gate for Archidekt lookups triggered on login -- shared by
    -- the opportunistic username refresh (authController.login) and the
    -- eventual full login-triggered scout flow (HANDOFF_CREDITS.md).
    last_scout_at TIMESTAMPTZ,
    -- Cached total public deck count from Archidekt, captured for free at
    -- verification (the full deck list is already in memory to find the
    -- match) and refreshed alongside the username at login. Nullable --
    -- unknown until the first verify()/login() populates it.
    archidekt_deck_count INTEGER,
    -- Schema shape only from HANDOFF_CREDITS.md -- the regen job and
    -- deduct-then-refund spending logic aren't built yet, so nothing
    -- spends credits. Defaults match the documented free-tier values.
    credits_balance INTEGER NOT NULL DEFAULT 10,
    credits_max INTEGER NOT NULL DEFAULT 10,
    tier VARCHAR(20) NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_archidekt_user_id ON users(archidekt_user_id);

-- status: 'pending' (key issued, not yet matched to a deck) or 'verified'
-- (consumed -- a verified key must never be usable again, even on retry).
CREATE TABLE IF NOT EXISTS pending_registrations (
    registration_key TEXT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    claimed_username VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_username ON pending_registrations(claimed_username);

-- Deck ownership, added via ALTER (not inline on commander_decks' own
-- CREATE TABLE above) because users doesn't exist yet at that point in
-- this file. Nullable / ON DELETE SET NULL: commander_decks rows are
-- scraped independently of registration, so most will have no owning
-- ArchRider user, and deleting a user shouldn't cascade-delete deck data
-- that's still valid, publicly-sourced content.
ALTER TABLE commander_decks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_commander_decks_user_id ON commander_decks(user_id);

-- Backfill archidekt_user_id for users who verified before that column
-- existed. No live Archidekt call needed -- commander_decks.owner_id is
-- already cached from scout.js for any deck matching their claimed
-- username, so this is a pure offline correlation against existing data.
UPDATE users u
SET archidekt_user_id = cd.owner_id
FROM commander_decks cd
WHERE cd.owner_username = u.archidekt_username
  AND u.archidekt_user_id IS NULL
  AND cd.owner_id IS NOT NULL;

-- Additional deck-ownership backfill via the stable owner ID -- more
-- robust than the owner_username-based match above, which breaks the
-- moment a user renames on Archidekt after already being verified here.
UPDATE commander_decks cd
SET user_id = u.id
FROM users u
WHERE cd.owner_id = u.archidekt_user_id
  AND u.archidekt_user_id IS NOT NULL
  AND cd.user_id IS NULL;