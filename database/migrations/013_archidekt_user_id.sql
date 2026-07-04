-- 013_archidekt_user_id.sql
-- Captures the stable numeric Archidekt owner ID discovered at
-- verification time (see authController.verify -- the matched deck's
-- owner.id field, same one scout.js already reads when populating
-- commander_decks.owner_id). archidekt_username stays for display/the
-- initial claim, but is just a cached, potentially-stale label going
-- forward: if a user renames on Archidekt, we still recognize them by
-- this ID rather than orphaning their account. Nullable because it's
-- only known after a successful verification, not at pending-registration
-- time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS archidekt_user_id INTEGER UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_archidekt_user_id ON users(archidekt_user_id);

-- Backfill archidekt_user_id for users who verified before this column
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
-- robust than migration 012's username-based match, which breaks the
-- moment a user renames on Archidekt after already being verified here.
UPDATE commander_decks cd
SET user_id = u.id
FROM users u
WHERE cd.owner_id = u.archidekt_user_id
  AND u.archidekt_user_id IS NOT NULL
  AND cd.user_id IS NULL;
