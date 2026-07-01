import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NameplateBadge from './NamePlateBadge';
import BracketBadge from './BracketBadge';
import CardPreview from './CardPreview';

const DeckDisplayTable = () => {
    const { deckID } = useParams();
    const [deckData, setDeckData] = useState(null);
    const [categorizedCards, setCategorizedCards] = useState({});
    const [commanders, setCommanders] = useState([]);
    const [companion, setCompanion] = useState(null);
    const [hoveredCard, setHoveredCard] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };
    const getImageUrl = (printingID) => {
        // Assuming printingID is the Scryfall UUID
        return `https://cards.scryfall.io/normal/front/${printingID[0]}/${printingID[1]}/${printingID}.jpg`;
    };

    useEffect(() => {
        fetch(`/api/decks/${deckID}`)
            .then(res => res.json())
            .then(data => {
                setDeckData(data);

                // Filter out Commanders/Companions for the main list
                const mainboard = data.card_list.mainboard || [];
                const sideboard = data.card_list.sideboard || [];

                setCommanders(mainboard.filter(c => c.isCommander));
                setCompanion(sideboard.find(c => c.isCompanion) || null);

                const regularCards = mainboard.filter(c => !c.isCommander);

                // Group by the first category
                const groups = regularCards.reduce((acc, card) => {
                    const category = card.categories[2] || card.categories[1] || card.categories[0] || 'Uncategorized';

                    if (!acc[category]) {
                        acc[category] = {
                            cards: [],
                            totalCount: 0
                        };
                    }

                    acc[category].cards.push(card);
                    // Add the quantity field (defaulting to 1 if it doesn't exist)
                    acc[category].totalCount += (card.quantity || 1);

                    return acc;
                }, {});

                setCategorizedCards(groups);
            });
    }, [deckID]);

    if (!deckData) return <div className="p-10 text-center">Loading deck library...</div>;
    
    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header & Spotlight Section */}
            <div className="mb-8 border-b border-slate-200 pb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800">{deckData.name}</h1>
                    <NameplateBadge identity={deckData.color_identity} />
                </div>

                <div className="flex gap-12 text-sm">
                    {/* Spotlight Section - Commanders */}
                    {commanders.length > 0 && (
                        <div>
                            <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">- Commander -</h4>
                            {commanders.map(c => (
                                <div
                                    key={c.oracleID}
                                    className="font-semibold text-slate-700 cursor-pointer hover:text-blue-600 transition-colors"
                                    onMouseEnter={() => setHoveredCard(c)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    onMouseMove={handleMouseMove}
                                >
                                    {c.name}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Spotlight Section - Companion */}
                    {companion && (
                        <div>
                            <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">- Companion -</h4>
                            <div
                                className="font-semibold text-slate-700 cursor-pointer hover:text-blue-600 transition-colors"
                                onMouseEnter={() => setHoveredCard(companion)}
                                onMouseLeave={() => setHoveredCard(null)}
                                onMouseMove={handleMouseMove}
                            >
                                {companion.name}
                            </div>
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">- Bracket -</h4>
                        <BracketBadge cardCount={deckData.edh_bracket}>
                            {deckData.edh_bracket}
                        </BracketBadge>
                    </div>
                </div>
            </div>

            {/* Main Board Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {Object.entries(categorizedCards).map(([category, group]) => (
                    <div key={category} className="bg-white p-4 border border-slate-200 rounded shadow-sm">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-100 pb-1 flex justify-between">
                            {category}
                            {/* Show the total sum here */}
                            <span className="text-slate-300 font-normal">{group.totalCount}</span>
                        </h3>
                        <ul className="text-sm space-y-1.5">
                            {group.cards.map((card, idx) => (
                                <li
                                    key={idx}
                                    onMouseEnter={() => setHoveredCard(card)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    onMouseMove={handleMouseMove}
                                    className="flex gap-2 cursor-pointer"
                                >
                                    <span className="text-slate-400 font-mono text-xs mt-0.5">{card.quantity}x</span>
                                    <span className="text-slate-700 hover:text-blue-600 transition-colors">{card.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            {hoveredCard && (
                <CardPreview
                    cardName={hoveredCard.name}
                    imageUrl={getImageUrl(hoveredCard.printingID)}
                    x={mousePos.x}
                    y={mousePos.y}
                    windowHeight={window.innerHeight} // Pass the current viewport height
                />
            )}
        </div>
    );
};

export default DeckDisplayTable;