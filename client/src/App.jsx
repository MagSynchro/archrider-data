import { useEffect, useState } from 'react';
// 1. Add these imports
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; 
import DeckTable from './components/DeckTable';
import DeckDisplayTable from './components/DeckDisplayTable';

function App() {
  const [decks, setDecks] = useState([]);

  useEffect(() => {
    fetch('/api/decks')
      .then(res => res.json())
      .then(data => setDecks(data))
      .catch(err => console.error("Error:", err));
  }, []);

  return (
    // 2. Wrap everything in a Router
    <Router>
      <div className="p-10">
        <h1 className="text-2xl font-bold mb-6">ArchRider Dashboard</h1>
        
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