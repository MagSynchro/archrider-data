-- card_taggings had no uniqueness constraint, so re-running the oracle_tags
-- import (even accidentally) silently duplicated every (tag_id, oracle_id)
-- pairing. Confirmed via live data: every tagging on Sol Ring appeared
-- exactly twice with identical weight.
--
-- Step 1: collapse existing duplicates, keeping one row per (tag_id, oracle_id).
-- ctid is Postgres' internal physical row identifier -- safe to use here
-- since this table has no primary key of its own to dedupe against.
DELETE FROM card_taggings a
USING card_taggings b
WHERE a.ctid < b.ctid
  AND a.tag_id = b.tag_id
  AND a.oracle_id = b.oracle_id;

-- Step 2: prevent this from ever happening again.
ALTER TABLE card_taggings
  ADD CONSTRAINT card_taggings_tag_oracle_unique UNIQUE (tag_id, oracle_id);