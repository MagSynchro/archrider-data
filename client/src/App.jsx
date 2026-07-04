// App.jsx
import { useEffect, useState } from 'react';
// 1. Add these imports
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DeckTable from './components/DeckTable';
import DeckDisplayTable from './components/DeckDisplayTable';
import AuthPage from './components/AuthPage';

function App() {
  const [decks, setDecks] = useState([]);
  // undefined = still checking the session, null = logged out, object = logged in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/decks')
      .then(res => res.json())
      .then(data => setDecks(data))
      .catch(err => console.error("Error:", err));
  }, [user]);

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => setUser(null));
  };

  if (user === undefined) {
    return <div className="p-10 text-center text-slate-400">Loading...</div>;
  }

  if (user === null) {
    return <AuthPage onLogin={setUser} />;
  }

  return (
    // 2. Wrap everything in a Router
    <Router>
      <div className="p-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">ArchRider Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{user.archidektUsername}</span>
            <button onClick={handleLogout} className="text-blue-600 hover:underline">Log Out</button>
          </div>
        </div>

        {/* 3. Define your routes here */}
        <Routes>
          <Route path="/" element={<DeckTable data={decks} />} />
          <Route path="/decks/:deckID" element={<DeckDisplayTable />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
