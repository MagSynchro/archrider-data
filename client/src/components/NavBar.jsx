// NavBar.jsx
import React from 'react';
import { Link } from 'react-router-dom';

// Top-of-page navigation shown for any active session. Pending sessions
// only ever have Profile to go to (everything else redirects there
// anyway -- see App.jsx); confirmed sessions get the full set. Profile >
// My Decks > Deck is the intended hierarchy. There used to be an
// unauthenticated cross-user "All Decks (Admin)" view here too, but that
// was scaffolding from before real staff accounts existed -- it let any
// logged-in consumer browse every other user's decks. That capability
// now lives properly access-controlled in the staff portal (/staff ->
// Decks tab), so it was removed from here rather than left duplicated
// and unguarded.
const NavBar = ({ session, isConfirmed, onLogout }) => (
    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-6">
            <span className="text-2xl font-bold text-slate-800">ArchRider</span>
            {isConfirmed && (
                <nav className="flex gap-4 text-sm font-medium text-slate-600">
                    <Link to="/profile" className="hover:text-blue-600">Profile</Link>
                    <Link to="/my-decks" className="hover:text-blue-600">My Decks</Link>
                </nav>
            )}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{session.archidektUsername || session.email}</span>
            <button onClick={onLogout} className="text-blue-600 hover:underline">Log Out</button>
        </div>
    </div>
);

export default NavBar;
