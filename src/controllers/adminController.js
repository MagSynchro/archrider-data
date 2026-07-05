// adminController.js
// Full Admin/Moderator action set (see HANDOFF_ADMIN.md). Route-level
// gating decides which functions are admin-only vs shared with
// moderators -- see adminRoutes.js. Every mutating action here calls
// logStaffAction so it shows up in the audit log (GET /api/admin/actions).
const bcrypt = require('bcrypt');
const db = require('../../database/db.js');
const { logStaffAction } = require('../utils/auditLog.js');
const { generatePassphrase } = require('../utils/passphrase.js');
const { fetchAllDecksForOwner } = require('../utils/archidektDecks.js');
const { upsertDeckList } = require('../utils/deckSync.js');
const { probeDeckById } = require('../utils/deckProbe.js');

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_PREFIX = { admin: 'Admin-', moderator: 'Mod-', owner: 'Owner-' };

// -- Staff account management -------------------------------------------
// Reachable by Admin or Owner (see requireAdminRole.js), but which
// *target* role is allowed differs by caller role -- enforced here, not
// at the route level, since it depends on the request body/target row:
//   - Moderator accounts: creatable/deletable by Admin or Owner.
//   - Admin accounts: creatable/deletable by Owner only. This is the
//     whole point of the Owner tier -- an Admin (even a compromised one)
//     can no longer create itself a fresh Admin account after being
//     removed, or delete every other Admin.
//   - Owner accounts: never creatable or deletable through this API at
//     all, by anyone, regardless of caller role. Only a bootstrap/DB
//     script can create or remove an Owner -- if Owner-creation were
//     reachable through the API, a compromised Owner session could mint
//     more Owners, reintroducing the exact takeover risk this split
//     exists to close off. See HANDOFF_ADMIN.md.

// Creates a new staff account. Enforces the Admin-/Mod- username prefix
// convention so staff identity is recognizable at a glance anywhere it's
// logged (audit log, etc.) -- see migration 019/020's header comments.
exports.createStaffAccount = async (req, res) => {
    const { username, password, email, realName, role } = req.body;

    if (role === 'owner') {
        return res.status(403).json({ error: 'Owner accounts cannot be created via this endpoint' });
    }
    if (!role || !ROLE_PREFIX[role]) {
        return res.status(400).json({ error: "role must be 'admin' or 'moderator'" });
    }
    if (role === 'admin' && req.staff.role !== 'owner') {
        return res.status(403).json({ error: 'Only Owner accounts can create Admin accounts' });
    }
    if (!username || !username.startsWith(ROLE_PREFIX[role])) {
        return res.status(400).json({ error: `username must start with "${ROLE_PREFIX[role]}" for role ${role}` });
    }
    if (!email || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!realName || !realName.trim()) {
        return res.status(400).json({ error: 'realName is required' });
    }
    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        const { rows: existing } = await db.query(
            'SELECT id FROM staff_accounts WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'A staff account already exists with that username or email' });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const { rows } = await db.query(
            `INSERT INTO staff_accounts (username, email, password_hash, real_name, role, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, username, email, real_name, role, created_at`,
            [username, email, passwordHash, realName.trim(), role, req.staff.id]
        );
        const created = rows[0];

        await logStaffAction(req.staff, 'create_staff_account', {
            targetType: 'staff_account',
            targetId: created.id,
            details: { username: created.username, email: created.email, role: created.role }
        });

        res.status(201).json(created);
    } catch (err) {
        console.error('Error creating staff account:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Hard delete (see HANDOFF_ADMIN.md -- deliberate, not a soft-disable).
// Guards: can't delete yourself, can't delete an Owner account via this
// endpoint at all, and deleting an Admin account requires Owner.
exports.deleteStaffAccount = async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await db.query('SELECT * FROM staff_accounts WHERE id = $1', [id]);
        const target = rows[0];
        if (!target) {
            return res.status(404).json({ error: 'Staff account not found' });
        }
        if (String(target.id) === String(req.staff.id)) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        if (target.role === 'owner') {
            return res.status(403).json({ error: 'Owner accounts cannot be deleted via this endpoint' });
        }
        if (target.role === 'admin' && req.staff.role !== 'owner') {
            return res.status(403).json({ error: 'Only Owner accounts can delete Admin accounts' });
        }

        await db.query('DELETE FROM staff_accounts WHERE id = $1', [id]);

        await logStaffAction(req.staff, 'delete_staff_account', {
            targetType: 'staff_account',
            targetId: id,
            details: { username: target.username, email: target.email, role: target.role }
        });

        res.json({ deleted: true, id });
    } catch (err) {
        console.error('Error deleting staff account:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Owner-only: resets another staff member's password. Scoped to
// Admin/Moderator targets -- Owner accounts are excluded even from this,
// consistent with Owner accounts never being touchable via the API (see
// above). Same direct-reset approach as resetUserPassword: no outbound
// email infra exists, so the new passphrase is returned once in the
// response for the Owner to relay out-of-band.
exports.resetStaffPassword = async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await db.query('SELECT id, username, email, role FROM staff_accounts WHERE id = $1', [id]);
        const target = rows[0];
        if (!target) {
            return res.status(404).json({ error: 'Staff account not found' });
        }
        if (target.role === 'owner') {
            return res.status(403).json({ error: 'Owner account passwords cannot be reset via this endpoint' });
        }

        const newPassword = generatePassphrase();
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE staff_accounts SET password_hash = $1 WHERE id = $2', [passwordHash, id]);

        await logStaffAction(req.staff, 'reset_staff_password', {
            targetType: 'staff_account',
            targetId: id,
            details: { username: target.username, email: target.email, role: target.role }
        });

        res.json({ id, newPassword });
    } catch (err) {
        console.error('Error resetting staff password:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.listStaffAccounts = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, username, email, real_name, role, created_by, created_at FROM staff_accounts ORDER BY created_at ASC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error listing staff accounts:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// -- Audit log (admin only) ---------------------------------------------

exports.listActions = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM staff_actions ORDER BY created_at DESC LIMIT 200'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error listing staff actions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// -- User management (shared: ban/unban/reset are admin+moderator) ------

exports.listUsers = async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT id, email, archidekt_username, archidekt_user_id, tier,
                    credits_balance, credits_max, banned_at, ban_reason, created_at
             FROM users ORDER BY created_at ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error('Error listing users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.banUser = async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    try {
        const { rows } = await db.query(
            'UPDATE users SET banned_at = NOW(), ban_reason = $1 WHERE id = $2 RETURNING id, email',
            [reason || null, userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await logStaffAction(req.staff, 'ban_user', {
            targetType: 'user',
            targetId: userId,
            details: { email: rows[0].email, reason: reason || null }
        });

        res.json({ banned: true, userId });
    } catch (err) {
        console.error('Error banning user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.unbanUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const { rows } = await db.query(
            'UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = $1 RETURNING id, email',
            [userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await logStaffAction(req.staff, 'unban_user', {
            targetType: 'user',
            targetId: userId,
            details: { email: rows[0].email }
        });

        res.json({ banned: false, userId });
    } catch (err) {
        console.error('Error unbanning user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Directly sets a new password rather than an email-based reset-token
// flow -- there's no outbound email infra in this project. The generated
// passphrase is returned once, in the response, for the staff member to
// relay to the user out-of-band; it's never stored anywhere in plaintext.
exports.resetUserPassword = async (req, res) => {
    const { userId } = req.params;

    try {
        const { rows: userRows } = await db.query('SELECT id, email FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newPassword = generatePassphrase();
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

        await logStaffAction(req.staff, 'reset_user_password', {
            targetType: 'user',
            targetId: userId,
            details: { email: userRows[0].email }
        });

        res.json({ userId, newPassword });
    } catch (err) {
        console.error('Error resetting user password:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// -- Admin-only: credits, sync/probe on behalf of a user -----------------

// Adds (or removes, if amount is negative) credits for documented
// technical-issue reasons. Deliberately uncapped by credits_max -- this
// is a manual override outside the normal regen/spend economy, not a
// refund (see src/utils/credits.js for the capped version used there).
exports.addCredits = async (req, res) => {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!Number.isInteger(amount) || amount === 0) {
        return res.status(400).json({ error: 'amount must be a non-zero integer' });
    }
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'reason is required' });
    }

    try {
        const { rows } = await db.query(
            'UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2 RETURNING id, email, credits_balance',
            [amount, userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await logStaffAction(req.staff, 'add_credits', {
            targetType: 'user',
            targetId: userId,
            details: { email: rows[0].email, amount, reason: reason.trim() }
        });

        res.json({ userId, creditsBalance: rows[0].credits_balance });
    } catch (err) {
        console.error('Error adjusting credits:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin support action -- syncs a user's full decklist on their behalf.
// Free (no credit deduction from the user or anyone else): this is
// troubleshooting/support work, not a metered consumer action. Always
// dispatched on the 'staff' priority lane regardless of the target
// user's own tier (see archidektThrottle.js).
exports.syncUserDecks = async (req, res) => {
    const { userId } = req.params;

    try {
        const { rows: userRows } = await db.query(
            'SELECT id, archidekt_user_id, archidekt_username FROM users WHERE id = $1',
            [userId]
        );
        const user = userRows[0];
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.archidekt_user_id) {
            return res.status(400).json({ error: 'No linked Archidekt account id on file for this user' });
        }

        const decks = await fetchAllDecksForOwner({ ownerId: user.archidekt_user_id, tier: 'staff' });
        const ownerUsername = decks[0]?.owner?.username || user.archidekt_username;
        const { results, staleDecks } = await upsertDeckList(decks, { ownerUsername, force: false, skipPurge: false });

        if (decks.length > 0) {
            await db.query(
                'UPDATE commander_decks SET user_id = $1 WHERE archidekt_id = ANY($2) AND user_id IS NULL',
                [userId, decks.map(d => d.id)]
            );
        }

        await db.query(
            'UPDATE users SET archidekt_deck_count = $1, last_scout_at = NOW() WHERE id = $2',
            [decks.length, userId]
        );

        await logStaffAction(req.staff, 'admin_sync_user_decks', {
            targetType: 'user',
            targetId: userId,
            details: { decksSynced: decks.length, decksUpdated: results.filter(r => r.wasUpdated).length, decksPurged: staleDecks.length }
        });

        res.json({
            totalDecks: decks.length,
            decksSynced: decks.length,
            decksUpdated: results.filter(r => r.wasUpdated).length,
            decksPurged: staleDecks.length
        });
    } catch (err) {
        console.error(`Error admin-syncing decks for user ${userId}:`, err.message);
        res.status(502).json({ error: 'Failed to reach Archidekt' });
    }
};

// Admin support action -- probes a single deck on a user's behalf. Free,
// same rationale as syncUserDecks above.
exports.probeDeckForUser = async (req, res) => {
    const { deckId } = req.params;

    try {
        await probeDeckById(deckId, { tier: 'staff' });

        await logStaffAction(req.staff, 'admin_probe_deck', {
            targetType: 'deck',
            targetId: deckId
        });

        res.json({ probed: true, deckId });
    } catch (err) {
        console.error(`Error admin-probing deck ${deckId}:`, err.message);
        res.status(502).json({ error: 'Failed to sync this deck from Archidekt' });
    }
};

// -- Deck management (shared: delete is admin+moderator) -----------------

exports.listDecks = async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT cd.*, u.email AS owner_email
             FROM commander_decks cd
             LEFT JOIN users u ON u.id = cd.user_id
             ORDER BY cd.updated_at DESC NULLS LAST`
        );
        res.json(rows);
    } catch (err) {
        console.error('Error listing decks for admin view:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteDeck = async (req, res) => {
    const { deckId } = req.params;

    try {
        const { rows } = await db.query('SELECT archidekt_id, name FROM commander_decks WHERE archidekt_id = $1', [deckId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        await db.query('DELETE FROM commander_decks WHERE archidekt_id = $1', [deckId]);

        await logStaffAction(req.staff, 'delete_deck', {
            targetType: 'deck',
            targetId: deckId,
            details: { name: rows[0].name }
        });

        res.json({ deleted: true, deckId });
    } catch (err) {
        console.error('Error deleting deck:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
