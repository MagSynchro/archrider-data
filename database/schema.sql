CREATE TABLE IF NOT EXISTS commander_decks (
    archidekt_id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    card_count INTEGER,
    format_id INTEGER,
    color_identity JSONB,
    owner_username VARCHAR(100),
    ownerID INTEGER,
    edh_bracket VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_username ON commander_decks(owner_username);
CREATE INDEX IF NOT EXISTS idx_edh_bracket ON commander_decks(edh_bracket);