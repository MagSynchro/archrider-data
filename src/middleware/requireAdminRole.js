// requireAdminRole.js
// Mount AFTER requireStaffAuth -- narrows a valid staff session down to
// admin-level actions (add credits, sync/probe on behalf of a user, view
// the audit log, view/create/delete staff accounts). Owner has every
// Admin capability plus more (see requireOwnerRole.js), so it passes
// here too -- the finer-grained Admin-vs-Owner split for staff account
// create/delete (Admin can only target Moderator accounts; only Owner
// can target Admin accounts) is enforced inside adminController.js,
// since it depends on the target role, not just the caller's role.
// Moderator-shared actions (ban/unban, delete deck, password reset
// assist for regular users) use requireStaffAuth alone.
module.exports = function requireAdminRole(req, res, next) {
    if (!req.staff || (req.staff.role !== 'admin' && req.staff.role !== 'owner')) {
        return res.status(403).json({ error: 'Admin role required' });
    }
    next();
};
