// RegisterForm.jsx
import React, { useState } from 'react';

// Collects account basics and starts registration (see
// HANDOFF_REGISTRATION.md). register() issues a pending session cookie
// immediately, so once this succeeds the parent just needs to pick that
// session up -- the key/instructions/recheck flow lives on ProfilePage
// now, not here, since a pending user can navigate there directly.
const RegisterForm = ({ onRegistered, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [archidektUsername, setArchidektUsername] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password, archidektUsername })
        })
            .then(async res => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Registration failed');
                onRegistered();
            })
            .catch(err => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Email</label>
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Archidekt Username</label>
                <input
                    type="text"
                    required
                    value={archidektUsername}
                    onChange={(e) => setArchidektUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
            >
                {submitting ? 'Starting...' : 'Register'}
            </button>

            <p className="text-sm text-slate-500 text-center">
                Already registered?{' '}
                <button type="button" onClick={onSwitchToLogin} className="text-blue-600 hover:underline">
                    Log In
                </button>
            </p>
        </form>
    );
};

export default RegisterForm;
