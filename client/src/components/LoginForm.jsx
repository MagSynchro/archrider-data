// LoginForm.jsx
import React, { useState } from 'react';

// Email/password login. Calls onLogin(user) on success so the parent can
// switch out of the auth gate -- the session itself lives in the httpOnly
// cookie the backend sets, this component doesn't touch it directly.
const LoginForm = ({ onLogin, onSwitchToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
            >
                {submitting ? 'Logging in...' : 'Log In'}
            </button>

            <p className="text-sm text-slate-500 text-center">
                Don't have an account?{' '}
                <button type="button" onClick={onSwitchToRegister} className="text-blue-600 hover:underline">
                    Register
                </button>
            </p>
        </form>
    );
};

export default LoginForm;
