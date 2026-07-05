// requireStaffAuth.js
const jwt = require('jsonwebtoken');
const db = require('../../database/db.js');
const { STAFF_SESSION_COOKIE } = require('../controllers/staffAuthController.js');

// Verifies the staff session cookie and re-reads the account fresh from
// staff_accounts on every request -- never trusts a cached role/username
// from the JWT. This matters more here than for consumer sessions: staff
// accounts can be hard-deleted (see HANDOFF_ADMIN.md), so an existing
// token for an account that no longer exists must stop working
// immediately, not linger until its 12h expiry.
module.exports = async function requireStaffAuth(req, res, next) {
    const token = req.cookies?.[STAFF_SESSION_COOKIE];
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.type !== 'staff') {
            return res.status(403).json({ error: 'Not a staff session' });
        }

        const { rows } = await db.query(
            'SELECT id, username, email, real_name, role FROM staff_accounts WHERE id = $1',
            [payload.sub]
        );
        const staff = rows[0];
        if (!staff) {
            return res.status(401).json({ error: 'Staff account no longer exists' });
        }

        req.staff = {
            id: staff.id,
            username: staff.username,
            email: staff.email,
            realName: staff.real_name,
            role: staff.role
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid' });
    }
};
