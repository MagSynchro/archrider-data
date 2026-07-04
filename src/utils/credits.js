// credits.js
const db = require('../../database/db.js');

// Atomically deducts `amount` credits if (and only if) the user currently
// has enough -- a single guarded UPDATE rather than a separate
// SELECT-then-UPDATE, so two concurrent requests can't both read a
// balance that looks sufficient and overdraw it. Returns true if the
// deduction happened, false if the balance was too low (deducts nothing
// in that case). Per HANDOFF_CREDITS.md's threat model, this must run
// BEFORE the Archidekt call it's paying for goes out, with refundCredits
// called if that call then fails.
async function deductCredits(userId, amount) {
    const { rowCount } = await db.query(
        'UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2 AND credits_balance >= $1',
        [amount, userId]
    );
    return rowCount > 0;
}

// Refunds `amount` credits, capped at the user's max so a refund can
// never push them over their tier ceiling.
async function refundCredits(userId, amount) {
    await db.query(
        'UPDATE users SET credits_balance = LEAST(credits_balance + $1, credits_max) WHERE id = $2',
        [amount, userId]
    );
}

module.exports = { deductCredits, refundCredits };
