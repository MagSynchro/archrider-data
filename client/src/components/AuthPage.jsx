// AuthPage.jsx
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

// Shown whenever there's no active session at all (not even a pending
// one). Toggles between the login and registration forms; onAuthenticated
// bubbles up to App whenever either one succeeds, so it can pick up the
// new session cookie (pending or confirmed) and swap the gate for the
// real app.
const AuthPage = ({ onAuthenticated }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register'

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded p-8">
                <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">ArchRider</h1>
                {mode === 'login' ? (
                    <LoginForm onLogin={onAuthenticated} onSwitchToRegister={() => setMode('register')} />
                ) : (
                    <RegisterForm onRegistered={onAuthenticated} onSwitchToLogin={() => setMode('login')} />
                )}
            </div>
        </div>
    );
};

export default AuthPage;
