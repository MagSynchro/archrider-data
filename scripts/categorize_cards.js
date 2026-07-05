// categorize_cards.js
//
// Resolves each card's card_category / normalized_category from its
// Scryfall oracle tags, using tag_category_map for the tag -> category
// lookup, with tag_category_patterns as a lower-priority fallback for
// tag FAMILIES (e.g. typal-%) so future variants of a known family don't
// require a manual mapping row every time a new one shows up. An exact
// match always wins over a pattern match for the same tag.
//
// Run this any time tag_category_map or tag_category_patterns is
// updated (it's a full re-resolution, not incremental) or after a fresh
// oracle_tags import.
//
// Conflict resolution: card_taggings.weight turned out to be ~99.7% the
// single value "median" across the dataset, so it is NOT a reliable
// primary discriminator. priority (your curated judgment, from either
// table) is the primary sort key; weight only breaks ties between
// otherwise-equal-priority tags.
//
// Also persists a SECONDARY category (migration 021, card_category_
// secondary / normalized_category_secondary) -- the runner-up candidate
// (rn = 2) from the exact same ranking used to pick the primary (rn = 1),
// rather than discarding it. Candidates are collapsed to one row per
// (oracle_id, card_category) before ranking so that two different tags
// mapping to the SAME category don't manufacture a fake "secondary" --
// the secondary is only ever a genuinely different category. Used by the
// deck view's core-synergy feature as a fallback grouping label for a
// SYNERGY card that doesn't match a deck's chosen core synergy.
require('dotenv').config();
const db = require('../database/db.js');

async function run() {
    const client = await db.pool.connect();
    try {
        console.log('Resolving card categories from tag_category_map + tag_category_patterns...');

        const result = await client.query(`
            WITH ranked AS (
                -- Exact tag matches
                SELECT
                    ct.oracle_id,
                    tcm.card_category,
                    tcm.normalized_category,
                    tcm.priority,
                    CASE ct.weight
                        WHEN 'very_strong' THEN 2
                        WHEN 'strong' THEN 1
                        ELSE 0
                    END AS weight_rank
                FROM card_taggings ct
                JOIN tags t ON t.id = ct.tag_id
                JOIN tag_category_map tcm ON tcm.tag_slug = t.slug

                UNION ALL

                -- Pattern fallback -- only for tags with NO exact match,
                -- so a precise mapping always takes priority over a
                -- generic family rule for the same tag.
                SELECT
                    ct.oracle_id,
                    tcp.card_category,
                    tcp.normalized_category,
                    tcp.priority,
                    CASE ct.weight
                        WHEN 'very_strong' THEN 2
                        WHEN 'strong' THEN 1
                        ELSE 0
                    END AS weight_rank
                FROM card_taggings ct
                JOIN tags t ON t.id = ct.tag_id
                JOIN tag_category_patterns tcp ON t.slug LIKE tcp.pattern
                WHERE NOT EXISTS (
                    SELECT 1 FROM tag_category_map tcm WHERE tcm.tag_slug = t.slug
                )
            ),
            -- Collapse to one row per (oracle_id, card_category) -- several
            -- different tags can resolve to the same category (e.g. two
            -- distinct typal tags both -> SYN_TYPAL); that must not count
            -- as two separate candidates when picking a primary vs a
            -- genuinely different secondary category.
            collapsed AS (
                SELECT
                    oracle_id,
                    card_category,
                    normalized_category,
                    MAX(priority) AS priority,
                    MAX(weight_rank) AS weight_rank
                FROM ranked
                GROUP BY oracle_id, card_category, normalized_category
            ),
            final_ranked AS (
                SELECT
                    oracle_id,
                    card_category,
                    normalized_category,
                    ROW_NUMBER() OVER (
                        PARTITION BY oracle_id
                        ORDER BY priority DESC, weight_rank DESC
                    ) AS rn
                FROM collapsed
            ),
            pivoted AS (
                SELECT
                    oracle_id,
                    MAX(CASE WHEN rn = 1 THEN card_category END) AS card_category,
                    MAX(CASE WHEN rn = 1 THEN normalized_category END) AS normalized_category,
                    MAX(CASE WHEN rn = 2 THEN card_category END) AS card_category_secondary,
                    MAX(CASE WHEN rn = 2 THEN normalized_category END) AS normalized_category_secondary
                FROM final_ranked
                WHERE rn <= 2
                GROUP BY oracle_id
            )
            UPDATE cards c
            SET card_category = p.card_category,
                normalized_category = p.normalized_category,
                card_category_secondary = p.card_category_secondary,
                normalized_category_secondary = p.normalized_category_secondary
            FROM pivoted p
            WHERE p.oracle_id = c.oracle_id
            RETURNING c.oracle_id;
        `);

        console.log(`Categorized ${result.rowCount} cards.`);

        // Coverage report: how much of the card pool got a category at all,
        // and how many taggings exist on tags that aren't covered by
        // either the exact map or a pattern yet (useful for prioritizing
        // the next round of taxonomy curation).
        const { rows: coverage } = await client.query(`
            SELECT
                COUNT(*) FILTER (WHERE normalized_category IS NOT NULL) AS categorized,
                COUNT(*) AS total
            FROM cards;
        `);
        console.log(`Coverage: ${coverage[0].categorized} / ${coverage[0].total} cards have a normalized_category.`);

        const { rows: unmapped } = await client.query(`
            SELECT t.slug, t.label, COUNT(*) AS occurrences
            FROM card_taggings ct
            JOIN tags t ON t.id = ct.tag_id
            LEFT JOIN tag_category_map tcm ON tcm.tag_slug = t.slug
            WHERE tcm.tag_slug IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM tag_category_patterns tcp WHERE t.slug LIKE tcp.pattern
              )
            GROUP BY t.slug, t.label
            ORDER BY occurrences DESC
            LIMIT 20;
        `);
        if (unmapped.length > 0) {
            console.log('\nTop 20 unmapped tags still in use (candidates for the next taxonomy pass):');
            for (const row of unmapped) {
                console.log(`  ${row.slug}  (${row.occurrences} taggings)`);
            }
        }
    } catch (e) {
        console.error('Error during categorization:', e.message);
        throw e;
    } finally {
        client.release();
    }
}

run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));