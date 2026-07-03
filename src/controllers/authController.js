// authController.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../database/db.js');
const { throttledFetch } = require('../utils/archidektThrottle.js');

// UX call, not a security one -- verification is self-securing regardless
// of lifetime (see HANDOFF_REGISTRATION.md). 4 hours is forgiving of
// interruptions between generating the key and creating the deck.
const KEY_LIFETIME_MS = 4 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;
const SESSION_COOKIE = 'archrider_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const sessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS
};

// Paginates the same unofficial per-user deck listing endpoint scout.js
// uses, looking for a deck whose name exactly matches the registration key.
async function findDeckByExactName(username, exactName) {
    let nextUrl = `https://archidekt.com/api/decks/v3/?ownerUsername=${encodeURIComponent(username)}&pageSize=50`;
    while (nextUrl) {
        const response = await throttledFetch(nextUrl);
        if (!response.ok) throw new Error(`Archidekt lookup failed: ${response.status}`);
        const data = await response.json();
        if ((data.results || []).some(deck => deck.name === exactName)) return true;
        nextUrl = data.next;
    }
    return false;
}

// Starts a registration attempt: validates input, issues a single-use
// registration key, and stores the pending account (password already
// hashed) until verify() finds a matching Archidekt deck.
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
// consumes the key in one transaction so the two writes can't diverge.
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

        const found = await findDeckByExactName(pending.claimed_username, pending.registration_key);
        if (!found) {
            return res.json({ verified: false, message: 'No matching deck found yet. Create it on Archidekt and try again.' });
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO users (email, password_hash, archidekt_username) VALUES ($1, $2, $3)',
                [pending.email, pending.password_hash, pending.claimed_username]
            );
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

        const token = jwt.sign(
            { sub: user.id, email: user.email, archidektUsername: user.archidekt_username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
        res.json({
            id: user.id,
            email: user.email,
            archidektUsername: user.archidekt_username
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
