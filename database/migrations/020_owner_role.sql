-- 020_owner_role.sql
-- Adds 'owner' to staff_accounts.role. Owner is a strictly-more-
-- privileged tier than Admin, created specifically so that Admin
-- accounts can no longer create or delete other Admin accounts (a
-- system-takeover risk: a compromised or rogue Admin could otherwise
-- mint itself a fresh Admin account after being removed, or delete
-- every other Admin). Owner accounts are never created or deleted via
-- the running app at all -- only via a bootstrap/DB script, for the
-- same reason: if Owner-creation were reachable through the API, a
-- compromised Owner session could mint more Owners, reintroducing the
-- exact risk this migration exists to close off. See HANDOFF_ADMIN.md.
ALTER TABLE staff_accounts DROP CONSTRAINT IF EXISTS staff_accounts_role_check;
ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_check
    CHECK (role IN ('admin', 'moderator', 'owner'));
