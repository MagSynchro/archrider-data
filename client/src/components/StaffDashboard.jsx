// StaffDashboard.jsx
import React, { useEffect, useState } from 'react';

const TABS = [
    { key: 'users', label: 'Users' },
    { key: 'decks', label: 'Decks' },
    { key: 'staff', label: 'Staff Accounts', adminOnly: true },
    { key: 'actions', label: 'Audit Log', adminOnly: true }
];

const ROLE_PREFIX = { admin: 'Admin-', moderator: 'Mod-', owner: 'Owner-' };

async function jsonOrThrow(res) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
}

// Single-page admin/moderator/owner dashboard -- tabs rather than nested
// routes to keep this simple. Role gating on the frontend just hides
// tabs/buttons a role can't use; the real enforcement is
// requireAdminRole/requireOwnerRole plus the target-role checks inside
// adminController.js on the backend (see adminRoutes.js). Owner has
// every Admin capability plus the Admin-account and staff-password-reset
// powers Admin no longer has (see HANDOFF_ADMIN.md).
const StaffDashboard = ({ staff, onLogout }) => {
    const isOwner = staff.role === 'owner';
    const isAdmin = staff.role === 'admin' || isOwner;
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [decks, setDecks] = useState([]);
    const [staffAccounts, setStaffAccounts] = useState([]);
    const [actions, setActions] = useState([]);
    const [message, setMessage] = useState(null);
    const [newStaff, setNewStaff] = useState({ username: '', password: '', email: '', realName: '', role: 'moderator' });
    const [creatingStaff, setCreatingStaff] = useState(false);

    const loadUsers = () => fetch('/api/admin/users', { credentials: 'include' }).then(jsonOrThrow).then(setUsers).catch(err => setMessage(err.message));
    const loadDecks = () => fetch('/api/admin/decks', { credentials: 'include' }).then(jsonOrThrow).then(setDecks).catch(err => setMessage(err.message));
    const loadStaffAccounts = () => fetch('/api/admin/staff', { credentials: 'include' }).then(jsonOrThrow).then(setStaffAccounts).catch(err => setMessage(err.message));
    const loadActions = () => fetch('/api/admin/actions', { credentials: 'include' }).then(jsonOrThrow).then(setActions).catch(err => setMessage(err.message));

    useEffect(() => {
        setMessage(null);
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'decks') loadDecks();
        if (activeTab === 'staff' && isAdmin) loadStaffAccounts();
        if (activeTab === 'actions' && isAdmin) loadActions();
    }, [activeTab]);

    const handleBan = (user) => {
        if (user.banned_at) {
            if (!window.confirm(`Unban ${user.email}?`)) return;
            fetch(`/api/admin/users/${user.id}/unban`, { method: 'POST', credentials: 'include' })
                .then(jsonOrThrow).then(loadUsers).catch(err => setMessage(err.message));
        } else {
            const reason = window.prompt(`Ban reason for ${user.email}:`);
            if (reason === null) return;
            fetch(`/api/admin/users/${user.id}/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ reason })
            }).then(jsonOrThrow).then(loadUsers).catch(err => setMessage(err.message));
        }
    };

    const handleResetPassword = (user) => {
        if (!window.confirm(`Generate a new password for ${user.email}? The new passphrase will be shown once -- relay it to the user yourself.`)) return;
        fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST', credentials: 'include' })
            .then(jsonOrThrow)
            .then(body => window.alert(`New password for ${user.email}:\n\n${body.newPassword}\n\nThis is shown only once -- copy it now.`))
            .catch(err => setMessage(err.message));
    };

    const handleAddCredits = (user) => {
        const amountStr = window.prompt(`Credits to add for ${user.email} (negative to remove):`, '5');
        if (amountStr === null) return;
        const amount = parseInt(amountStr, 10);
        if (!Number.isInteger(amount) || amount === 0) return setMessage('Amount must be a non-zero integer');
        const reason = window.prompt('Reason (required, goes in the audit log):');
        if (!reason || !reason.trim()) return setMessage('A reason is required to add credits');
        fetch(`/api/admin/users/${user.id}/credits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ amount, reason })
        }).then(jsonOrThrow).then(loadUsers).catch(err => setMessage(err.message));
    };

    const handleSyncUser = (user) => {
        if (!window.confirm(`Sync ${user.email}'s full decklist from Archidekt now? Free -- doesn't touch their credits.`)) return;
        setMessage(`Syncing ${user.email}...`);
        fetch(`/api/admin/users/${user.id}/sync`, { method: 'POST', credentials: 'include' })
            .then(jsonOrThrow)
            .then(body => setMessage(`Synced ${user.email}: ${body.decksSynced} decks (${body.decksUpdated} updated, ${body.decksPurged} purged)`))
            .catch(err => setMessage(err.message));
    };

    const handleDeleteDeck = (deck) => {
        if (!window.confirm(`Delete deck "${deck.name}" (#${deck.archidekt_id}) from ArchRider? This cannot be undone.`)) return;
        fetch(`/api/admin/decks/${deck.archidekt_id}`, { method: 'DELETE', credentials: 'include' })
            .then(jsonOrThrow).then(loadDecks).catch(err => setMessage(err.message));
    };

    const handleProbeDeck = (deck) => {
        if (!window.confirm(`Probe deck "${deck.name}" now? Free -- doesn't touch anyone's credits.`)) return;
        fetch(`/api/admin/decks/${deck.archidekt_id}/probe`, { method: 'POST', credentials: 'include' })
            .then(jsonOrThrow).then(() => setMessage(`Probed "${deck.name}"`)).catch(err => setMessage(err.message));
    };

    const handleCreateStaff = (e) => {
        e.preventDefault();
        setMessage(null);
        setCreatingStaff(true);
        fetch('/api/admin/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(newStaff)
        })
            .then(jsonOrThrow)
            .then(() => {
                setNewStaff({ username: '', password: '', email: '', realName: '', role: 'moderator' });
                loadStaffAccounts();
            })
            .catch(err => setMessage(err.message))
            .finally(() => setCreatingStaff(false));
    };

    const handleDeleteStaff = (account) => {
        if (!window.confirm(`Hard-delete staff account "${account.username}"? This cannot be undone.`)) return;
        fetch(`/api/admin/staff/${account.id}`, { method: 'DELETE', credentials: 'include' })
            .then(jsonOrThrow).then(loadStaffAccounts).catch(err => setMessage(err.message));
    };

    // Owner-only -- resets an Admin/Moderator staff member's password
    // (separate from resetUserPassword above, which targets regular
    // consumer users).
    const handleResetStaffPassword = (account) => {
        if (!window.confirm(`Generate a new password for staff account "${account.username}"? The new passphrase will be shown once -- relay it to them yourself.`)) return;
        fetch(`/api/admin/staff/${account.id}/reset-password`, { method: 'POST', credentials: 'include' })
            .then(jsonOrThrow)
            .then(body => window.alert(`New password for ${account.username}:\n\n${body.newPassword}\n\nThis is shown only once -- copy it now.`))
            .catch(err => setMessage(err.message));
    };

    return (
        <div className="p-10 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <div>
                    <span className="text-2xl font-bold text-slate-800">ArchRider Staff</span>
                    <p className="text-sm text-slate-500">{staff.realName} &middot; <strong>{staff.username}</strong> &middot; {staff.role}</p>
                </div>
                <button onClick={onLogout} className="text-blue-600 hover:underline text-sm">Log Out</button>
            </div>

            <nav className="flex gap-4 mb-6 text-sm font-medium">
                {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-3 py-1.5 rounded ${activeTab === t.key ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {message && <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">{message}</div>}

            {activeTab === 'users' && (
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                            <th className="py-2">Email</th>
                            <th>Archidekt</th>
                            <th>Tier</th>
                            <th>Credits</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b border-slate-100">
                                <td className="py-2">{u.email}</td>
                                <td>{u.archidekt_username}</td>
                                <td>{u.tier}</td>
                                <td>{u.credits_balance} / {u.credits_max}</td>
                                <td>{u.banned_at ? <span className="text-red-600">Banned{u.ban_reason ? `: ${u.ban_reason}` : ''}</span> : 'Active'}</td>
                                <td className="py-2 space-x-2 whitespace-nowrap">
                                    <button onClick={() => handleBan(u)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:border-slate-500">
                                        {u.banned_at ? 'Unban' : 'Ban'}
                                    </button>
                                    <button onClick={() => handleResetPassword(u)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:border-slate-500">Reset PW</button>
                                    {isAdmin && <button onClick={() => handleAddCredits(u)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:border-slate-500">Add Credits</button>}
                                    {isAdmin && <button onClick={() => handleSyncUser(u)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:border-slate-500">Sync Decks</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeTab === 'decks' && (
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                            <th className="py-2">Name</th>
                            <th>Owner (Archidekt)</th>
                            <th>Owner (ArchRider)</th>
                            <th>Cards</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {decks.map(d => (
                            <tr key={d.archidekt_id} className="border-b border-slate-100">
                                <td className="py-2">{d.name}</td>
                                <td>{d.owner_username}</td>
                                <td>{d.owner_email || '--'}</td>
                                <td>{d.card_count}</td>
                                <td className="py-2 space-x-2 whitespace-nowrap">
                                    {isAdmin && <button onClick={() => handleProbeDeck(d)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:border-slate-500">Probe</button>}
                                    <button onClick={() => handleDeleteDeck(d)} className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:border-red-500">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeTab === 'staff' && isAdmin && (
                <div className="space-y-6">
                    <form onSubmit={handleCreateStaff} className="bg-white border border-slate-200 rounded p-4 grid grid-cols-2 gap-3">
                        <div className="col-span-2 text-xs font-bold uppercase text-slate-500">Create Staff Account</div>
                        <select
                            value={newStaff.role}
                            onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded text-sm"
                        >
                            <option value="moderator">Moderator</option>
                            {isOwner && <option value="admin">Admin</option>}
                        </select>
                        <input
                            placeholder={`Username (must start with "${ROLE_PREFIX[newStaff.role]}")`}
                            value={newStaff.username}
                            onChange={e => setNewStaff({ ...newStaff, username: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded text-sm"
                            required
                        />
                        <input
                            placeholder="Real name"
                            value={newStaff.realName}
                            onChange={e => setNewStaff({ ...newStaff, realName: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded text-sm"
                            required
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newStaff.email}
                            onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded text-sm"
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password (min 8 chars)"
                            value={newStaff.password}
                            onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                            className="px-3 py-2 border border-slate-200 rounded text-sm"
                            required
                        />
                        <button
                            type="submit"
                            disabled={creatingStaff}
                            className="col-span-2 px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                        >
                            {creatingStaff ? 'Creating...' : 'Create Account'}
                        </button>
                    </form>

                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                                <th className="py-2">Username</th>
                                <th>Real Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffAccounts.map(a => {
                                // Owner accounts are untouchable through this UI entirely
                                // (no create/delete/reset-password via the API at all --
                                // see HANDOFF_ADMIN.md). Deleting an Admin account
                                // requires Owner; deleting a Moderator account is fine
                                // for Admin or Owner (anyone who can reach this tab).
                                const canDelete = a.role !== 'owner' && (a.role !== 'admin' || isOwner);
                                const canResetPassword = isOwner && a.role !== 'owner';
                                return (
                                    <tr key={a.id} className="border-b border-slate-100">
                                        <td className="py-2">{a.username}</td>
                                        <td>{a.real_name}</td>
                                        <td>{a.email}</td>
                                        <td>{a.role}</td>
                                        <td>{new Date(a.created_at).toLocaleDateString()}</td>
                                        <td className="space-x-2 whitespace-nowrap">
                                            {canResetPassword && <button onClick={() => handleResetStaffPassword(a)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:border-slate-500">Reset PW</button>}
                                            {canDelete && <button onClick={() => handleDeleteStaff(a)} className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:border-red-500">Delete</button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'actions' && isAdmin && (
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                            <th className="py-2">When</th>
                            <th>Actor</th>
                            <th>Action</th>
                            <th>Target</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map(a => (
                            <tr key={a.id} className="border-b border-slate-100 align-top">
                                <td className="py-2 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                                <td>{a.actor_username} <span className="text-slate-400">({a.actor_email})</span></td>
                                <td>{a.action}</td>
                                <td>{a.target_type ? `${a.target_type} #${a.target_id}` : '--'}</td>
                                <td className="font-mono text-xs text-slate-500">{a.details ? JSON.stringify(a.details) : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default StaffDashboard;
