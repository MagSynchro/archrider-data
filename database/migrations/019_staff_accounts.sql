-- 019_staff_accounts.sql
-- Admin/Moderator accounts as a wholly separate entity from `users`,
-- rather than reusing users.role (migration 018) for it. Staff accounts
-- are never tied to Archidekt data -- no archidekt_username/
-- archidekt_user_id, no tier/credits. An admin explicitly supplies
-- username/password/email/real_name/role when creating one; there's no
-- self-registration or Archidekt-ownership-verification path for staff.
--
-- Convention (not enforced at the DB layer, enforced in the create-
-- moderator controller): usernames are prefixed Admin-/Mod- by role, so
-- staff identity is recognizable at a glance anywhere it's logged.
--
-- created_by is nullable because the very first admin account(s) are
-- seeded by a one-off bootstrap script, not created via the "generate
-- moderator account" endpoint -- there's no admin yet to attribute that
-- to.
CREATE TABLE IF NOT EXISTS staff_accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    real_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'moderator')),
    created_by INTEGER REFERENCES staff_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log for every admin/moderator action. actor_username/actor_email
-- are a snapshot captured at the moment of the action, not a live join --
-- moderator accounts are hard-deleted (per design), and the whole point
-- of this table is to keep a durable record of who did what (and, per
-- the user's explicit ask, to retain the email of a removed bad actor so
-- it can be recognized if they try to re-enter the admin ecosystem under
-- a new account later). actor_staff_id is kept too, best-effort, for
-- joining against still-existing accounts; ON DELETE SET NULL so a hard
-- delete never cascades into losing log rows.
CREATE TABLE IF NOT EXISTS staff_actions (
    id SERIAL PRIMARY KEY,
    actor_staff_id INTEGER REFERENCES staff_accounts(id) ON DELETE SET NULL,
    actor_username VARCHAR(50) NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(30),
    target_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_actions_actor_email ON staff_actions(actor_email);
CREATE INDEX IF NOT EXISTS idx_staff_actions_created_at ON staff_actions(created_at);

-- Platform ban (regular users only -- staff accounts are managed via
-- generate/delete, not ban/unban). banned_at IS NULL means not banned;
-- set/cleared by the admin/moderator ban+unban actions. Enforced at
-- login (authController.login) and on every authenticated request
-- (requireAuth) so a ban takes effect immediately rather than waiting
-- out an existing session's 7-day cookie lifetime.
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- Superseded by staff_accounts -- a real Archidekt-linked user should
-- never be admin/moderator under the new model, so this column can only
-- ever be 'user' going forward and is just noise.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP COLUMN IF EXISTS role;
