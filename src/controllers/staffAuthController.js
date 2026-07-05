// staffAuthController.js
// Login/session handling for staff (Admin/Moderator) accounts -- a
// wholly separate entity from consumer `users` (see HANDOFF_ADMIN.md).
// No self-registration: staff_accounts rows only ever come from the
// bootstrap script or the admin-only "create moderator" endpoint
// (adminController.createModerator).
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../database/db.js');

const BCRYPT_ROUNDS = 10;
// Separate cookie from the consumer session (archrider_session) so a
// staff member can be logged in as staff and, in the same browser, stay
// logged into their own unrelated consumer account (this is a real case
// here -- the bootstrap Admin account and the real moraff@gmail.com
// consumer account share an email but are different entities entirely).
const STAFF_SESSION_COOKIE = 'archrider_staff_session';
const STAFF_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h -- shorter-lived than consumer sessions, elevated privileges

const staffCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: STAFF_SESSION_MAX_AGE_MS
};

function issueStaffSession(res, staff) {
    const token = jwt.sign(
        { type: 'staff', sub: staff.id },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );
    res.cookie(STAFF_SESSION_COOKIE, token, staffCookieOptions);
}

// Accepts either username or email as the identifier -- staff accounts
// are created with both, and "Admin-Shane" is easier to type at a staff
// login prompt than an email address.
exports.login = async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ error: 'Username/email and password are required' });
    }

    try {
        const { rows } = await db.query(
            'SELECT * FROM staff_accounts WHERE username = $1 OR email = $1',
            [identifier]
        );
        const staff = rows[0];
        if (!staff) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const passwordMatches = await bcrypt.compare(password, staff.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        issueStaffSession(res, staff);
        res.json({
            id: staff.id,
            username: staff.username,
            email: staff.email,
            realName: staff.real_name,
            role: staff.role
        });
    } catch (err) {
        console.error('Error logging in staff account:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie(STAFF_SESSION_COOKIE, staffCookieOptions);
    res.json({ loggedOut: true });
};

// Returns the currently logged-in staff account, per requireStaffAuth's
// fresh DB read (req.staff).
exports.me = (req, res) => {
    res.json(req.staff);
};

module.exports.STAFF_SESSION_COOKIE = STAFF_SESSION_COOKIE;
module.exports.issueStaffSession = issueStaffSession;
