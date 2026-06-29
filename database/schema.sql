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

-- 2. Parent Table for Cards: Stores the unique Oracle Identity (one record per card)
CREATE TABLE IF NOT EXISTS cards (
    oracle_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    layout VARCHAR(50),
    cmc_total NUMERIC,
    mana_cost_total VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cards_name ON cards(name);

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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_card_faces_parent ON card_faces(parent_oracle_id);
CREATE INDEX idx_card_faces_artist_id ON card_faces(artist_id);
CREATE INDEX idx_card_faces_raw ON card_faces USING GIN (raw_face_data);

CREATE TABLE card_printings (
    id UUID PRIMARY KEY, -- The specific Scryfall ID (the printing)
    oracle_id UUID REFERENCES cards(oracle_id), -- The link to rules
    set_code VARCHAR(10),
    collector_number VARCHAR(10),
    is_foil BOOLEAN,
    -- This table is what you reference when you import a deck
    raw_printing_data JSONB
);
CREATE INDEX idx_printings_oracle_id ON card_printings(oracle_id);

CREATE TABLE tags (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE,
    label TEXT
);
CREATE TABLE card_taggings (
    tag_id UUID REFERENCES tags(id),
    oracle_id UUID REFERENCES cards(oracle_id),
    weight TEXT
);
CREATE INDEX idx_card_taggings_oracle_id ON card_taggings(oracle_id);
CREATE INDEX idx_card_taggings_tag_id ON card_taggings(tag_id);