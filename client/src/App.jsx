// App.jsx
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import DeckTable from './components/DeckTable';
import DeckDisplayTable from './components/DeckDisplayTable';
import UserDeckTable from './components/UserDeckTable';
import ProfilePage from './components/ProfilePage';
import AuthPage from './components/AuthPage';
import NavBar from './components/NavBar';

// Everything session-dependent lives inside the Router so it can use
// useNavigate to land on /profile after login/registration, regardless
// of whatever URL the browser happened to be on beforehand.
function AppShell() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = no session, object = GET /api/auth/profile response
  const [decks, setDecks] = useState([]);
  const navigate = useNavigate();

  const refreshSession = () => {
    return fetch('/api/auth/profile', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(setSession)
      .catch(() => setSession(null));
  };

  useEffect(() => {
    refreshSession();
  }, []);

  useEffect(() => {
    if (session?.status !== 'confirmed') return;
    fetch('/api/decks')
      .then(res => res.json())
      .then(setDecks)
      .catch(err => console.error("Error:", err));
  }, [session]);

  // Upon login / registration the user should land on Profile -- see the
  // profile-page design pass.
  const handleAuthenticated = () => {
    refreshSession().then(() => navigate('/profile'));
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => {
        setSession(null);
        navigate('/');
      });
  };

  if (session === undefined) {
    return <div className="p-10 text-center text-slate-400">Loading...</div>;
  }

  if (session === null) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  const isConfirmed = session.status === 'confirmed';

  return (
    <div className="p-10">
      <NavBar session={session} isConfirmed={isConfirmed} onLogout={handleLogout} />

      <Routes>
        <Route path="/profile" element={<ProfilePage session={session} onSessionChange={refreshSession} />} />
        {isConfirmed && <Route path="/" element={<DeckTable data={decks} />} />}
        {isConfirmed && <Route path="/my-decks" element={<UserDeckTable />} />}
        {isConfirmed && <Route path="/decks/:deckID" element={<DeckDisplayTable />} />}
        {/* Not-yet-confirmed sessions (pending/expired/verified_elsewhere) only
            ever have Profile to show -- send anything else there too. */}
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
