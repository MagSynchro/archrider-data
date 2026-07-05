// StaffLoginPage.jsx
import React, { useState } from 'react';

// Separate portal from the consumer AuthPage/LoginForm -- posts to
// /api/admin/login (staff_accounts), not /api/auth/login (users).
// Accepts either username (e.g. "Admin-Shane") or email as identifier.
const StaffLoginPage = ({ onLogin }) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ identifier, password })
        })
            .then(async res => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Login failed');
                onLogin(body);
            })
            .catch(err => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    return (
        <div className="max-w-sm mx-auto mt-24 p-6 bg-white border border-slate-200 rounded-lg shadow">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Staff Login</h2>
            <p className="text-xs text-slate-500 mb-4">Admin / Moderator access only.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Username or Email</label>
                    <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                >
                    {submitting ? 'Logging in...' : 'Log In'}
                </button>
            </form>
        </div>
    );
};

export default StaffLoginPage;
