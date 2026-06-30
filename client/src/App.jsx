import { useEffect, useState } from 'react';
import DeckTable from './components/DeckTable'; // Import it

function App() {
  const [decks, setDecks] = useState([]);

  useEffect(() => {
    fetch('/api/decks') // Using your proxy
      .then(res => res.json())
      .then(data => setDecks(data))
      .catch(err => console.error("Error:", err));
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">ArchRider Dashboard</h1>
      {/* Pass your data here */}
      <DeckTable data={decks} />
    </div>
  );
}

export default App;