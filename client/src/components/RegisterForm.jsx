// RegisterForm.jsx
import React, { useState } from 'react';

// Registration + Archidekt ownership verification (see HANDOFF_REGISTRATION.md).
// Three steps: collect account basics -> show the single-use registration
// key and wait for the user to create a matching public Archidekt deck ->
// confirm verification. No Archidekt credentials are ever collected here.
const RegisterForm = ({ onSwitchToLogin }) => {
    const [step, setStep] = useState('form'); // 'form' | 'pending' | 'verified'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [archidektUsername, setArchidektUsername] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [registrationKey, setRegistrationKey] = useState(null);
    const [expiresAt, setExpiresAt] = useState(null);
    const [verifyMessage, setVerifyMessage] = useState(null);

    const handleRegister = (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, archidektUsername })
        })
            .then(async res => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Registration failed');
                setRegistrationKey(body.registrationKey);
                setExpiresAt(body.expiresAt);
                setStep('pending');
            })
            .catch(err => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    const handleVerify = () => {
        setError(null);
        setVerifyMessage(null);
        setSubmitting(true);
        fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationKey })
        })
            .then(async res => {
                const body = await res.json();
                if (!res.ok) {
                    // Expired keys can't be retried -- send the user back to start over.
                    if (res.status === 410) setStep('form');
                    throw new Error(body.error || 'Verification failed');
                }
                if (body.verified) {
                    setStep('verified');
                } else {
                    setVerifyMessage(body.message);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setSubmitting(false));
    };

    if (step === 'verified') {
        return (
            <div className="space-y-4 text-center">
                <p className="text-sm text-slate-700">
                    Account verified and activated. You're free to delete or rename the verification deck on Archidekt now.
                </p>
                <button
                    onClick={onSwitchToLogin}
                    className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase"
                >
                    Log In
                </button>
            </div>
        );
    }

    if (step === 'pending') {
        return (
            <div className="space-y-4">
                <p className="text-sm text-slate-700">
                    Create a <strong>public</strong> Archidekt deck named exactly the key below under the username{' '}
                    <strong>{archidektUsername}</strong>, then click Verify. Content doesn't matter -- it can be empty.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                    <p className="font-mono text-sm break-all">{registrationKey}</p>
                </div>
                <p className="text-xs text-slate-400">
                    Expires {new Date(expiresAt).toLocaleString()}
                </p>

                {verifyMessage && <p className="text-sm text-slate-600">{verifyMessage}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                    onClick={handleVerify}
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                >
                    {submitting ? 'Checking...' : 'Verify'}
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleRegister} className="space-y-4">
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
