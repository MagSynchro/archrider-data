// ProfilePage.jsx
import React, { useState, useEffect } from 'react';

// Landing page after login/registration (see the profile-page design
// pass). Renders whatever GET /api/auth/profile currently reports:
// pending (still needs Archidekt verification), expired/verified_elsewhere
// (edge cases -- the pending session outlived or was overtaken by a real
// one), or confirmed (the normal logged-in state, with account stats and
// the email/password update form).
const ProfilePage = ({ session, onSessionChange }) => {
    const [verifyMessage, setVerifyMessage] = useState(null);
    const [verifyError, setVerifyError] = useState(null);
    const [verifying, setVerifying] = useState(false);

    // session is only otherwise refreshed on login/registration and full
    // page reloads -- without this, navigating back here after spending
    // credits/syncing elsewhere (UserDeckTable) would keep showing
    // whatever balance/stats were current at that last refresh, not
    // reality. Refetch every time this page is actually visited instead.
    useEffect(() => {
        onSessionChange();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRecheck = () => {
        setVerifyError(null);
        setVerifyMessage(null);
        setVerifying(true);
        fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ registrationKey: session.registrationKey })
        })
            .then(async res => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Verification failed');
                if (body.verified) {
                    onSessionChange();
                } else {
                    setVerifyMessage(body.message);
                }
            })
            .catch(err => setVerifyError(err.message))
            .finally(() => setVerifying(false));
    };

    if (session.status === 'pending') {
        return (
            <div className="max-w-lg mx-auto">
                <h2 className="text-xl font-bold text-slate-800 mb-1">Registration Pending</h2>
                <p className="text-sm text-slate-500 mb-6">{session.email} &middot; claiming Archidekt username <strong>{session.claimedUsername}</strong></p>

                <div className="bg-white border border-slate-200 rounded p-6 space-y-4">
                    <p className="text-sm text-slate-700">
                        Create a <strong>public, Commander-format</strong> Archidekt deck named exactly the key below under the username{' '}
                        <strong>{session.claimedUsername}</strong>, then click Recheck. Content doesn't matter -- it can be empty.
                    </p>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                        <p className="font-mono text-sm break-all">{session.registrationKey}</p>
                    </div>
                    <p className="text-xs text-slate-400">Expires {new Date(session.expiresAt).toLocaleString()}</p>

                    {verifyMessage && <p className="text-sm text-slate-600">{verifyMessage}</p>}
                    {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}

                    <button
                        onClick={handleRecheck}
                        disabled={verifying}
                        className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                    >
                        {verifying ? 'Checking...' : 'Recheck'}
                    </button>
                </div>
            </div>
        );
    }

    if (session.status === 'expired') {
        return (
            <div className="max-w-lg mx-auto text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Registration Expired</h2>
                <p className="text-sm text-slate-600">{session.message}</p>
            </div>
        );
    }

    if (session.status === 'verified_elsewhere') {
        return (
            <div className="max-w-lg mx-auto text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Already Verified</h2>
                <p className="text-sm text-slate-600">{session.message}</p>
            </div>
        );
    }

    return <ConfirmedProfile session={session} />;
};

// Split out for readability -- the confirmed state has a lot more going
// on (stats + the update form) than the pending states above.
const ConfirmedProfile = ({ session }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        const body = { currentPassword };
        if (newEmail) body.newEmail = newEmail;
        if (newPassword) {
            body.newPassword = newPassword;
            body.confirmNewPassword = confirmNewPassword;
        }

        fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        })
            .then(async res => {
                const responseBody = await res.json();
                if (!res.ok) throw new Error(responseBody.error || 'Update failed');
                setSuccess('Profile updated.');
                setCurrentPassword('');
                setNewEmail('');
                setNewPassword('');
                setConfirmNewPassword('');
            })
            .catch(err => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h2 className="text-xl font-bold text-slate-800">{session.email}</h2>
                <p className="text-sm text-slate-500">
                    Archidekt: <strong>{session.archidektUsername}</strong> &middot; confirmed {new Date(session.confirmedAt).toLocaleDateString()}
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{session.archidektDeckCount ?? '--'}</p>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Public Commander decks on Archidekt</p>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{session.ourDeckCount}</p>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Decks in ArchRider</p>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{session.credits.balance} / {session.credits.max}</p>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">API credits ({session.credits.tierLabel})</p>
                    <p className="text-[11px] text-slate-400 mt-1">+{session.credits.regenPerCycle} at next regen</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Update Account</h3>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Current Password</label>
                    <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Email</label>
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder={session.email}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Retype New Password</label>
                    <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}

                <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                >
                    {submitting ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
};

export default ProfilePage;
