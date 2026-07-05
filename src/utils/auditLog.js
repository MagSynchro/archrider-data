// auditLog.js
const db = require('../../database/db.js');

// Records one staff action to staff_actions. Snapshots the actor's
// username/email/role at call time rather than relying on a later join
// against staff_accounts -- moderator accounts are hard-deleted (see
// HANDOFF_ADMIN.md), and this log is specifically meant to survive that,
// including retaining a removed bad actor's email for future reference.
// `actor` is req.staff (as attached by requireStaffAuth). `targetId` is
// stringified since targets come from different tables with different
// key types.
async function logStaffAction(actor, action, { targetType = null, targetId = null, details = null } = {}) {
    await db.query(
        `INSERT INTO staff_actions
            (actor_staff_id, actor_username, actor_email, actor_role, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            actor.id,
            actor.username,
            actor.email,
            actor.role,
            action,
            targetType,
            targetId !== null && targetId !== undefined ? String(targetId) : null,
            details ? JSON.stringify(details) : null
        ]
    );
}

module.exports = { logStaffAction };
