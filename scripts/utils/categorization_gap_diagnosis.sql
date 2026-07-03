-- Characterizes WHY cards are uncategorized: no tags at all (hard ceiling,
-- nothing we can do) vs. has tags but none are mapped yet (real taxonomy
-- gap, actionable) vs. categorized already.
SELECT
    CASE
        WHEN c.normalized_category IS NOT NULL THEN 'categorized'
        WHEN ct.oracle_id IS NULL THEN 'uncategorized - no oracle tags at all'
        ELSE 'uncategorized - has tags, none mapped yet'
    END AS status,
    COUNT(DISTINCT c.oracle_id) AS card_count
FROM cards c
LEFT JOIN card_taggings ct ON ct.oracle_id = c.oracle_id
GROUP BY status
ORDER BY card_count DESC;