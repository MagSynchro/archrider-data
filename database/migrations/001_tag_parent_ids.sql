-- SUPERSEDED: your tags.parent_ids column already exists as UUID[]
-- (confirmed via \d tags on the live DB), so this migration is a no-op
-- if already applied. Left here only for a from-scratch environment
-- that hasn't run schema.sql yet.
ALTER TABLE tags ADD COLUMN IF NOT EXISTS parent_ids UUID[];
CREATE INDEX IF NOT EXISTS idx_tags_parent_ids ON tags USING GIN (parent_ids);