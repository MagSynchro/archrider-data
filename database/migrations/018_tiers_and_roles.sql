-- 018_tiers_and_roles.sql
-- Aligns users.tier with the named tier ladder (Wayfarer/Pathfinder/
-- Banneret/Cartographer -- "Initiate" is the unregistered state, so it
-- has no row to store; "Wayfarer" replaces the old "free" default).
-- Adds users.role, a separate axis from tier: staff permission level
-- (user/moderator/admin), orthogonal to which paid tier someone is on.
--
-- This migration only covers labeling/display -- the actual admin/
-- moderator actions (ban, delete decks, add credits, etc.) and the
-- tier upgrade/payment flow are not built yet, still future work.

UPDATE users SET tier = 'wayfarer' WHERE tier = 'free';
ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'wayfarer';

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_tier_check
        CHECK (tier IN ('wayfarer', 'pathfinder', 'banneret', 'cartographer'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('user', 'moderator', 'admin'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
