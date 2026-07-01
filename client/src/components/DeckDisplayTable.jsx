import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import NameplateBadge from './NamePlateBadge';
import BracketBadge from './BracketBadge';
import CardPreview from './CardPreview';

import { calculateManaCurve } from '../utils/manaUtils';


const DeckDisplayTable = () => {
    const { deckID } = useParams();
    const [deckData, setDeckData] = useState(null);
    const [categorizedCards, setCategorizedCards] = useState({});
    const [activeAnalysis, setActiveAnalysis] = useState(null); // e.g., 'manaCurve',etc, or null
    const [commanders, setCommanders] = useState([]);
    const [companion, setCompanion] = useState(null);
    const [hoveredCard, setHoveredCard] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const { curve, averageCmc } = useMemo(() => {
        // Only calculate if deckData and deckData.card_list exist
        if (!deckData?.card_list?.mainboard) return { curve: [], averageCmc: 0 };
        return calculateManaCurve(deckData.card_list.mainboard);
    }, [deckData]); // This will now correctly re-run once deckData is fetched

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
                        <BracketBadge level={deckData.edh_bracket}>
                            {deckData.edh_bracket}
                        </BracketBadge>
                    </div>
                </div>
            </div>
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveAnalysis(activeAnalysis === 'manaCurve' ? null : 'manaCurve')}
                    className={`px-4 py-2 border rounded text-xs font-bold uppercase transition-colors ${activeAnalysis === 'manaCurve' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    Mana Curve
                </button>
                {/* Add more buttons here for future analytics */}
            </div>
            {activeAnalysis === 'manaCurve' && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-6 relative">
                        {/* X Close Button */}
                        <button
                            onClick={() => setActiveAnalysis(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 text-2xl font-light transition-colors"
                        >
                            &times;
                        </button>

                        <h2 className="text-xl font-bold text-slate-800 mb-6">Mana Curve Analysis</h2>

                        <div className="text-sm text-slate-600 mb-6">
                            Avg Mana Value: <span className="font-bold">{averageCmc}</span>
                        </div>
                        <div className="flex items-end gap-2 h-48 border-b border-slate-200 pb-2">
                            {curve.map((item) => (
                                <div key={item.cmc} className="flex flex-col items-center flex-1 justify-end h-full">
                                    <div
                                        className="w-full bg-orange-500 opacity-80 rounded-t hover:opacity-100 transition-opacity"
                                        style={{
                                            height: `${(item.count / Math.max(...curve.map(c => c.count), 1)) * 100}%`
                                        }}
                                    />

                                    <span className="text-[10px] text-slate-400 mt-1">
                                        {item.count > 0 ? item.count : ''}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">{item.cmc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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