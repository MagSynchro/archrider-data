// NavBar.jsx
import React from 'react';
import { Link } from 'react-router-dom';

// Top-of-page navigation shown for any active session. Pending sessions
// only ever have Profile to go to (everything else redirects there
// anyway -- see App.jsx); confirmed sessions get the full set. Home/
// Profile > Decklist > Deck is the intended hierarchy -- DeckTable
// ("All Decks") stays for admin use per design, My Decks is the
// user-scoped view.
const NavBar = ({ session, isConfirmed, onLogout }) => (
    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-6">
            <span className="text-2xl font-bold text-slate-800">ArchRider</span>
            {isConfirmed && (
                <nav className="flex gap-4 text-sm font-medium text-slate-600">
                    <Link to="/profile" className="hover:text-blue-600">Profile</Link>
                    <Link to="/my-decks" className="hover:text-blue-600">My Decks</Link>
                    <Link to="/" className="hover:text-blue-600">All Decks (Admin)</Link>
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
