-- 011_registration_flow.sql
-- Registration + Archidekt ownership verification (see
-- HANDOFF_REGISTRATION.md for the full design writeup). No credentials
-- are ever exchanged with Archidekt -- ownership is proven by the user
-- creating a public deck named exactly the single-use registration_key
-- generated below, which only the real account owner can do under their
-- own Archidekt username.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    archidekt_username VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

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
