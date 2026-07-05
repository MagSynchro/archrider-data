// requireAuth.js
const jwt = require('jsonwebtoken');
const db = require('../../database/db.js');

// Verifies the session cookie and requires it to be a full verified-user
// session (type: 'user'), not a pending-registration session -- see
// requireSession.js for the version that accepts either. Attaches the
// decoded user onto req.user. Rejects with 401/403 if missing/invalid/
// not yet verified -- callers should mount this only on routes that need
// a real logged-in user (e.g. deck ownership, profile updates).
//
// Checks banned_at fresh from the DB on every request (not cached in the
// JWT) so an admin/moderator ban takes effect immediately -- otherwise a
// banned user's existing 7-day cookie would keep working until it
// naturally expired, defeating the point of banning them.
module.exports = async function requireAuth(req, res, next) {
    const token = req.cookies?.archrider_session;
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.type !== 'user') {
            return res.status(403).json({ error: 'Please verify your account first' });
        }

        const { rows } = await db.query('SELECT banned_at FROM users WHERE id = $1', [payload.sub]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Account no longer exists' });
        }
        if (rows[0].banned_at) {
            return res.status(403).json({ error: 'This account has been banned' });
        }

        req.user = {
            id: payload.sub,
            email: payload.email,
            archidektUsername: payload.archidektUsername,
            archidektUserId: payload.archidektUserId
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid' });
    }
};
