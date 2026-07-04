// AuthPage.jsx
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

// Shown whenever there's no active session. Toggles between the login
// and registration forms; onLogin bubbles up to App so it can swap the
// gate for the real app once a session cookie exists.
const AuthPage = ({ onLogin }) => {
    const [mode, setMode] = useState('login'); // 'login' | 'register'

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded p-8">
                <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">ArchRider</h1>
                {mode === 'login' ? (
                    <LoginForm onLogin={onLogin} onSwitchToRegister={() => setMode('register')} />
                ) : (
                    <RegisterForm onSwitchToLogin={() => setMode('login')} />
                )}
            </div>
        </div>
    );
};

export default AuthPage;
