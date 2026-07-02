-- card_faces had no uniqueness constraint, so re-running oracle_cards
-- after insertOracleCards was patched to populate oracle_text/power/
-- toughness/type_line/etc. left BOTH the old incomplete rows and new
-- complete rows for every card, rather than updating in place. Confirmed
-- via live data: Durnan of the Yawning Portal, Emperor Crocodile, and
-- others showed blank type_line/oracle_text despite having real tags,
-- because a stale pre-patch duplicate was the row being read.
--
-- Step 1: collapse duplicates, keeping the row with the HIGHEST id per
-- (parent_oracle_id, name) group. Since id is a SERIAL that increments
-- with insert order, the highest id is the most recently inserted row --
-- i.e. the one written by the patched, more-complete version of the
-- import script.
DELETE FROM card_faces a
USING card_faces b
WHERE a.parent_oracle_id = b.parent_oracle_id
  AND a.name = b.name
  AND a.id < b.id;

-- Step 2: prevent this from happening again.
ALTER TABLE card_faces
  ADD CONSTRAINT card_faces_parent_name_unique UNIQUE (parent_oracle_id, name);