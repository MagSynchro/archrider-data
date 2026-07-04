-- 014_last_scout_tracking.sql
-- Cooldown-gate timestamp for Archidekt lookups triggered on login.
-- Shared by two things that both want the same protection: the
-- opportunistic username refresh added in authController.login, and the
-- eventual full login-triggered scout flow from HANDOFF_CREDITS.md --
-- that flow's own step 1 cooldown gate is this same field, not a
-- separate mechanism.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_scout_at TIMESTAMPTZ;
