// requireAuth.js
const jwt = require('jsonwebtoken');

// Verifies the session cookie and requires it to be a full verified-user
// session (type: 'user'), not a pending-registration session -- see
// requireSession.js for the version that accepts either. Attaches the
// decoded user onto req.user. Rejects with 401/403 if missing/invalid/
// not yet verified -- callers should mount this only on routes that need
// a real logged-in user (e.g. deck ownership, profile updates).
module.exports = function requireAuth(req, res, next) {
    const token = req.cookies?.archrider_session;
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.type !== 'user') {
            return res.status(403).json({ error: 'Please verify your account first' });
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
