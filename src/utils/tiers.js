// tiers.js
// Single source of truth for tier/role display labels and regen amounts
// (see HANDOFF_CREDITS.md and migration 018). Only wired for display
// right now -- the actual regen job, tier upgrade/payment flow, and
// admin/moderator actions (ban, delete decks, add credits, etc.) are all
// still future work. "Initiate" (unregistered) isn't listed here since
// there's no user row to look a tier up for in that state.
//
// regenPerCycle for cartographer is a placeholder (5) -- the design
// brief only specified "maximum feasible API credits" without a concrete
// number. Easy to change here once a real value is decided; nothing
// else depends on the exact figure yet since the regen job doesn't
// exist.
const TIERS = {
    wayfarer: { label: 'Wayfarer', regenPerCycle: 1 },
    pathfinder: { label: 'Pathfinder', regenPerCycle: 2 },
    banneret: { label: 'Banneret', regenPerCycle: 2 },
    cartographer: { label: 'Cartographer', regenPerCycle: 5 }
};

const ROLES = {
    user: { label: 'User' },
    moderator: { label: 'Moderator' },
    admin: { label: 'Admin' }
};

function getTierInfo(tier) {
    return TIERS[tier] || TIERS.wayfarer;
}

function getRoleInfo(role) {
    return ROLES[role] || ROLES.user;
}

module.exports = { TIERS, ROLES, getTierInfo, getRoleInfo };
