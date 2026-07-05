// StaffApp.jsx
import React, { useEffect, useState } from 'react';
import StaffLoginPage from './StaffLoginPage';
import StaffDashboard from './StaffDashboard';

// Entirely independent of the consumer session in App.jsx -- staff auth
// uses its own cookie (archrider_staff_session, see staffAuthController.js)
// so a staff member can be logged in here and, in the same browser, stay
// logged into their own separate consumer account. Mounted at /staff/*
// in App.jsx, outside the consumer session gate.
function StaffApp() {
    const [staff, setStaff] = useState(undefined); // undefined = checking, null = logged out, object = logged in

    const refreshStaffSession = () => {
        return fetch('/api/admin/me', { credentials: 'include' })
            .then(res => (res.ok ? res.json() : null))
            .then(setStaff)
            .catch(() => setStaff(null));
    };

    useEffect(() => {
        refreshStaffSession();
    }, []);

    const handleLogout = () => {
        fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
            .finally(() => setStaff(null));
    };

    if (staff === undefined) {
        return <div className="p-10 text-center text-slate-400">Loading...</div>;
    }

    if (staff === null) {
        return <StaffLoginPage onLogin={setStaff} />;
    }

    return <StaffDashboard staff={staff} onLogout={handleLogout} />;
}

export default StaffApp;
