import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NameplateBadge from './NamePlateBadge';

const DeckDisplayTable = () => {
  const { deckID } = useParams();
  const [deckData, setDeckData] = useState(null);
  const [categorizedCards, setCategorizedCards] = useState({});
  const [commanders, setCommanders] = useState([]);
  const [companion, setCompanion] = useState(null);

useEffect(() => {
    fetch(`/api/decks/${deckID}`)
      .then(res => res.json())
      .then(data => {
        setDeckData(data);

        // 1. Extract Commanders from mainboard
        const commanders = data.card_list.mainboard.filter(c => c.isCommander);
        setCommanders(commanders);

        // 2. Extract Companion from sideboard
        const companion = data.card_list.sideboard.find(c => c.isCompanion) || null;
        setCompanion(companion);

        // 3. Group only the standard deck cards from mainboard
        // Filtering out commanders just in case they were left in mainboard
        const regularCards = data.card_list.mainboard.filter(c => !c.isCommander);
        
        const groups = regularCards.reduce((acc, card) => {
          const category = card.categories[0] || 'Uncategorized';
          if (!acc[category]) acc[category] = [];
          acc[category].push(card);
          return acc;
        }, {});
        
        setCategorizedCards(groups);
      });
  }, [deckID]);

  if (!deckData) return <div>Loading deck...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header and Spotlight */}
      <div className="mb-8 border-b pb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{deckData.name}</h1>
          <NameplateBadge identity={deckData.color_identity} />
        </div>

        <div className="flex gap-12">
          {commanders.length > 0 && (
            <div>
              <h4 className="font-bold text-gray-500 uppercase text-xs mb-1">- Commander -</h4>
              {commanders.map(c => <div key={c.oracleID} className="font-medium">{c.oracleID.slice(0, 8)}...</div>)}
            </div>
          )}
          {companion && (
            <div>
              <h4 className="font-bold text-gray-500 uppercase text-xs mb-1">- Companion -</h4>
              <div className="font-medium">{companion.oracleID.slice(0, 8)}...</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Deck Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(categorizedCards).map(([category, cards]) => (
          <div key={category} className="bg-white p-4 border rounded shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-3 border-b pb-1">
              {category} <span className="text-gray-400">({cards.length})</span>
            </h3>
            <ul className="text-sm space-y-1">
              {cards.map((card, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>{card.quantity}x ID: {card.oracleID.slice(0, 8)}...</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeckDisplayTable;