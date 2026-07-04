// requireAuth.js
const jwt = require('jsonwebtoken');

// Verifies the session cookie set by POST /api/auth/login and attaches
// the decoded user onto req.user. Rejects with 401 if missing/invalid --
// callers should mount this only on routes that require a logged-in user.
module.exports = function requireAuth(req, res, next) {
    const token = req.cookies?.archrider_session;
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
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
