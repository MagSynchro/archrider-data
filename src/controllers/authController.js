// authController.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../database/db.js');
const { fetchAllDecksForOwner, fetchOwnerInfo } = require('../utils/archidektDecks.js');

// UX call, not a security one -- verification is self-securing regardless
// of lifetime (see HANDOFF_REGISTRATION.md). 4 hours is forgiving of
// interruptions between generating the key and creating the deck.
const KEY_LIFETIME_MS = 4 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;
const SESSION_COOKIE = 'archrider_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Same cooldown window planned for the full login-triggered scout flow
// (HANDOFF_CREDITS.md) -- reusing users.last_scout_at means this doesn't
// need its own separate gate later.
const LOGIN_SYNC_COOLDOWN_MS = 30 * 60 * 1000;

const sessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS
};

// Issues a full verified-user session. Used by login(), by verify() (to
// seamlessly upgrade a pending session the moment an account is created,
// no separate login step needed), and by updateProfile() (email may have
// changed, so the cookie is reissued to match).
function issueUserSession(res, user) {
    const token = jwt.sign(
        {
            type: 'user',
            sub: user.id,
            email: user.email,
            archidektUsername: user.archidektUsername,
            archidektUserId: user.archidektUserId
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
}

// Issues a pending-registration session so a not-yet-verified user can
// still reach the Profile page (see HANDOFF_CREDITS.md's follow-up
// discussion / the profile-page design pass). Deliberately only ever
// issued to the browser that just created the pending_registrations row
// in this same request -- resuming one from a bare email/username match
// on a later request would let anyone who merely knows/guesses those
// hijack someone else's in-progress registration, since verify() upgrades
// whichever browser holds the session at the moment it succeeds. Payload
// only carries the key; getProfile() always re-reads live DB state
// rather than trusting anything else cached in the token.
function issuePendingSession(res, registrationKey) {
    const token = jwt.sign(
        { type: 'pending', sub: registrationKey },
        process.env.JWT_SECRET,
        { expiresIn: '4h' }
    );
    res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions, maxAge: KEY_LIFETIME_MS });
}

// Opportunistically refreshes stale cached Archidekt account info
// (username + total deck count): our login-triggered scout flow queries
// this account's deck list anyway (see HANDOFF_CREDITS.md), so a rename
// or new/deleted decks are caught here for free instead of needing a
// separate sync mechanism. Cooldown-gated for the same reason that
// flow's own free page-1 call is -- a burst of logins/tab refreshes
// shouldn't turn this into an uncapped Archidekt hit. Best-effort: a
// failed Archidekt call must never fail login itself, and only advances
// last_scout_at on success so a failed attempt retries next login rather
// than going quiet for the full cooldown.
async function refreshArchidektAccountInfoIfStale(user) {
    if (!user.archidekt_user_id) return; // nothing stable to look up by yet

    const lastSync = user.last_scout_at ? new Date(user.last_scout_at).getTime() : 0;
    if (Date.now() - lastSync < LOGIN_SYNC_COOLDOWN_MS) return;

    try {
        const info = await fetchOwnerInfo({ ownerId: user.archidekt_user_id });
        const username = info?.username || user.archidekt_username;
        const deckCount = info ? info.count : user.archidekt_deck_count;

        await db.query(
            'UPDATE users SET archidekt_username = $1, archidekt_deck_count = $2, last_scout_at = NOW() WHERE id = $3',
            [username, deckCount, user.id]
        );
        user.archidekt_username = username;
        user.archidekt_deck_count = deckCount;
    } catch (err) {
        console.error('Archidekt account info refresh failed (non-fatal):', err.message);
    }
}

// Looks up a pending registration's claimed username on Archidekt (we
// don't have their numeric owner ID yet at this point -- that's only
// discoverable from a deck response, which requires knowing the username
// first) and returns the full deck list plus the deck matching the
// registration key exactly, if any.
async function findVerificationDeck(username, exactName) {
    const decks = await fetchAllDecksForOwner({ ownerUsername: username });
    return { decks, match: decks.find(deck => deck.name === exactName) || null };
}

// Starts a registration attempt: validates input, issues a single-use
// registration key, and stores the pending account (password already
// hashed) until verify() finds a matching Archidekt deck. Also issues a
// pending session so the browser can reach the Profile page right away.
exports.register = async (req, res) => {
    const { email, password, archidektUsername } = req.body;

    if (!email || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!archidektUsername || !archidektUsername.trim()) {
        return res.status(400).json({ error: 'Archidekt username is required' });
    }
    const username = archidektUsername.trim();

    try {
        // Sweep expired pending attempts so they don't block new signups
        // for the same email/username or accumulate indefinitely.
        await db.query(
            "DELETE FROM pending_registrations WHERE status = 'pending' AND expires_at < NOW()"
        );

        const { rows: existingUsers } = await db.query(
            'SELECT id FROM users WHERE email = $1 OR archidekt_username = $2',
            [email, username]
        );
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'An account already exists for that email or Archidekt username' });
        }

        const { rows: activePending } = await db.query(
            "SELECT 1 FROM pending_registrations WHERE status = 'pending' AND (email = $1 OR claimed_username = $2)",
            [email, username]
        );
        if (activePending.length > 0) {
            return res.status(409).json({ error: 'A registration is already in progress for that email or Archidekt username' });
        }

        const registrationKey = crypto.randomBytes(24).toString('hex');
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const expiresAt = new Date(Date.now() + KEY_LIFETIME_MS);

        await db.query(
            `INSERT INTO pending_registrations
                (registration_key, email, password_hash, claimed_username, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [registrationKey, email, passwordHash, username, expiresAt]
        );

        issuePendingSession(res, registrationKey);

        res.status(201).json({
            registrationKey,
            expiresAt,
            instructions: `Create a public Archidekt deck named exactly "${registrationKey}" under the username "${username}", then call verify.`
        });
    } catch (err) {
        console.error('Error starting registration:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Checks Archidekt for a public deck matching the pending key's exact
// name under the claimed username. On match, activates the account and
// consumes the key in one transaction so the two writes can't diverge,
// then upgrades the session cookie to a full logged-in session.
exports.verify = async (req, res) => {
    const { registrationKey } = req.body;
    if (!registrationKey) {
        return res.status(400).json({ error: 'registrationKey is required' });
    }

    try {
        const { rows } = await db.query(
            'SELECT * FROM pending_registrations WHERE registration_key = $1',
            [registrationKey]
        );
        const pending = rows[0];

        if (!pending) {
            return res.status(404).json({ error: 'No registration found for that key' });
        }
        if (pending.status !== 'pending') {
            return res.status(409).json({ error: 'This registration key has already been used' });
        }
        if (new Date(pending.expires_at) < new Date()) {
            return res.status(410).json({ error: 'This registration key has expired. Please register again.' });
        }

        const { decks, match } = await findVerificationDeck(pending.claimed_username, pending.registration_key);
        if (!match) {
            return res.json({ verified: false, message: 'No matching deck found yet. Create it on Archidekt and try again.' });
        }

        // Capture the stable numeric owner ID from the matched deck now,
        // while we have it -- every future Archidekt lookup for this user
        // should key on this, not the username, so a later rename on
        // Archidekt can't orphan the account (see migration 013). The
        // deck count is free too -- we already paginated the full list to
        // find this match, so decks.length is an exact, live count.
        const archidektUserId = match.owner.id;

        let newUserId;
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const { rows: inserted } = await client.query(
                `INSERT INTO users (email, password_hash, archidekt_username, archidekt_user_id, archidekt_deck_count, last_scout_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 RETURNING id`,
                [pending.email, pending.password_hash, pending.claimed_username, archidektUserId, decks.length]
            );
            newUserId = inserted[0].id;
            await client.query(
                "UPDATE pending_registrations SET status = 'verified' WHERE registration_key = $1",
                [registrationKey]
            );
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        issueUserSession(res, {
            id: newUserId,
            email: pending.email,
            archidektUsername: pending.claimed_username,
            archidektUserId
        });

        res.json({ verified: true, message: 'Account verified and activated. You can now delete or rename the verification deck on Archidekt.' });
    } catch (err) {
        console.error('Error verifying registration:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Verifies email/password against the users table and issues a JWT
// session cookie. Kept intentionally minimal (no "remember me", no
// refresh tokens) -- see HANDOFF_CREDITS.md for what this unblocks.
exports.login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        await refreshArchidektAccountInfoIfStale(user);

        issueUserSession(res, {
            id: user.id,
            email: user.email,
            archidektUsername: user.archidekt_username,
            archidektUserId: user.archidekt_user_id
        });
        res.json({
            id: user.id,
            email: user.email,
            archidektUsername: user.archidekt_username,
            archidektUserId: user.archidekt_user_id
        });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    res.json({ loggedOut: true });
};

// Returns the currently logged-in user, per requireAuth's decoded token.
exports.me = (req, res) => {
    res.json(req.user);
};

// Backs the Profile page for both session types (see requireSession).
// Always re-reads live DB state rather than trusting anything cached in
// the token, since a pending registration's status can change (verified/
// expired) after the session was issued.
exports.getProfile = async (req, res) => {
    const session = req.session;

    try {
        if (session.type === 'pending') {
            const { rows } = await db.query(
                'SELECT * FROM pending_registrations WHERE registration_key = $1',
                [session.sub]
            );
            const pending = rows[0];

            if (!pending) {
                return res.status(404).json({ error: 'Registration no longer found. Please register again.' });
            }
            if (pending.status !== 'pending') {
                return res.json({
                    status: 'verified_elsewhere',
                    message: 'This registration has already been verified. Please log in.'
                });
            }
            if (new Date(pending.expires_at) < new Date()) {
                return res.json({
                    status: 'expired',
                    message: 'This registration key has expired. Please register again.'
                });
            }

            return res.json({
                status: 'pending',
                email: pending.email,
                claimedUsername: pending.claimed_username,
                registrationKey: pending.registration_key,
                expiresAt: pending.expires_at
            });
        }

        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [session.sub]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ error: 'Account no longer exists' });
        }

        const { rows: countRows } = await db.query(
            'SELECT COUNT(*) FROM commander_decks WHERE user_id = $1',
            [user.id]
        );

        res.json({
            status: 'confirmed',
            email: user.email,
            archidektUsername: user.archidekt_username,
            archidektUserId: user.archidekt_user_id,
            confirmedAt: user.created_at,
            archidektDeckCount: user.archidekt_deck_count,
            ourDeckCount: parseInt(countRows[0].count, 10),
            credits: { balance: user.credits_balance, max: user.credits_max, tier: user.tier }
        });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Updates email and/or password for a verified user. Requires the
// current password regardless of which field is changing -- a
// lightweight re-auth check before touching sensitive account fields.
exports.updateProfile = async (req, res) => {
    const { currentPassword, newEmail, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
    }
    if (!newEmail && !newPassword) {
        return res.status(400).json({ error: 'Provide a new email and/or a new password' });
    }
    if (newEmail && !EMAIL_RE.test(newEmail)) {
        return res.status(400).json({ error: 'A valid email is required' });
    }
    if (newPassword) {
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ error: 'New password and confirmation do not match' });
        }
    }

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ error: 'Account no longer exists' });
        }

        const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
        if (!currentMatches) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        if (newEmail && newEmail !== user.email) {
            const { rows: emailTaken } = await db.query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [newEmail, user.id]
            );
            if (emailTaken.length > 0) {
                return res.status(409).json({ error: 'That email is already in use' });
            }
        }

        const updatedEmail = newEmail || user.email;
        const updatedPasswordHash = newPassword
            ? await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
            : user.password_hash;

        await db.query(
            'UPDATE users SET email = $1, password_hash = $2 WHERE id = $3',
            [updatedEmail, updatedPasswordHash, user.id]
        );

        // Email may have changed -- reissue the session so the cookie
        // reflects the new value immediately rather than on next login.
        issueUserSession(res, {
            id: user.id,
            email: updatedEmail,
            archidektUsername: user.archidekt_username,
            archidektUserId: user.archidekt_user_id
        });

        res.json({ email: updatedEmail, message: 'Profile updated.' });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
