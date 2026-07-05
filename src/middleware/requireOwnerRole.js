// requireOwnerRole.js
// Mount AFTER requireStaffAuth -- the strictest gate, for Owner-exclusive
// actions (reset another staff member's password). Owner is the only
// role that can act on Admin accounts at all (create, delete, reset
// password) -- see requireAdminRole.js and adminController.js for why.
module.exports = function requireOwnerRole(req, res, next) {
    if (!req.staff || req.staff.role !== 'owner') {
        return res.status(403).json({ error: 'Owner role required' });
    }
    next();
};
