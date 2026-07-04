// requireSession.js
const jwt = require('jsonwebtoken');

// Accepts EITHER session type -- a pending registration (type: 'pending',
// issued by register()) or a full verified user (type: 'user', issued by
// login()/verify()). Attaches the raw decoded payload as req.session and
// lets the controller branch on req.session.type. Used by GET
// /api/auth/profile, which has to render both states; anything that
// needs a real logged-in user should use requireAuth instead.
module.exports = function requireSession(req, res, next) {
    const token = req.cookies?.archrider_session;
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        req.session = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid' });
    }
};
