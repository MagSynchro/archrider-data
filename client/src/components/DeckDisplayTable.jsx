import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NameplateBadge from './NamePlateBadge';
import BracketBadge from './BracketBadge';
import CardPreview from './CardPreview';
import DeckAnalysisModal from './DeckAnalysisModal'; // New Import

const DeckDisplayTable = () => {
    const { deckID } = useParams();
    const [deckData, setDeckData] = useState(null);
    const [categorizedCards, setCategorizedCards] = useState({});
    const [specialCategories, setSpecialCategories] = useState({});
    const [activeAnalysis, setActiveAnalysis] = useState(null); // 'manaCurve' or 'colorCurve'
    const [commanders, setCommanders] = useState([]);
    const [companion, setCompanion] = useState(null);
    const [hoveredCard, setHoveredCard] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    const getImageUrl = (pid) => `https://cards.scryfall.io/normal/front/${pid[0]}/${pid[1]}/${pid}.jpg`;

    useEffect(() => {
        fetch(`/api/decks/${deckID}`)
            .then(res => res.json())
            .then(data => {
                setDeckData(data);
                //1. Seperate cards into mainboard and sideboard
                const mainboard = data.card_list.mainboard || [];
                const sideboard = data.card_list.sideboard || [];
                // 2. Separate mainboard into non-land, land, and non-cards
                const regulars = [];
                const specials = {}; // Object to hold { "Stickers": [], "Attractions": [] }
                const lands = [];

                mainboard.filter(c => !c.isCommander).forEach(card => {
                    const primaryType = (card.categories?.[0] || "").toLowerCase();
                    if (primaryType === 'land') lands.push(card);
                    else if (['stickers', 'attraction'].includes(primaryType)) {
                        // Create dynamic category name based on type
                        const catName = primaryType.charAt(0).toUpperCase() + primaryType.slice(1);
                        if (!specials[catName]) specials[catName] = [];
                        specials[catName].push(card);
                    } else {
                        regulars.push(card);
                    }
                });
                setCommanders(mainboard.filter(c => c.isCommander));
                setCompanion(sideboard.find(c => c.isCompanion) || null);
                // 2. Group regular cards
                const groups = regulars.reduce((acc, card) => {
                    const cat = card.categories[2] || card.categories[1] || card.categories[0] || 'Uncategorized';
                    if (!acc[cat]) acc[cat] = { cards: [], totalCount: 0 };
                    acc[cat].cards.push(card);
                    acc[cat].totalCount += (card.quantity || 1);
                    return acc;
                }, {});

                // 3. Add Lands and Others as "Special Groups"
                if (lands.length > 0) groups['Lands'] = { cards: lands, totalCount: lands.reduce((sum, c) => sum + (c.quantity || 1), 0) };
                setSpecialCategories(specials);
                setCategorizedCards(groups);


            });
    }, [deckID]);

    if (!deckData) return <div className="p-10 text-center">Loading deck library...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8 border-b border-slate-200 pb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800">{deckData.name}</h1>
                    <NameplateBadge identity={deckData.color_identity} />
                </div>
                {/* Spotlight Section - Commanders */}
                {commanders.length > 0 && (
                    <div>
                        <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">- Commander -</h4>
                        {commanders.map(c => (
                            <div
                                key={c.oracleID}
                                className="cursor-pointer hover:text-blue-600"
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
                            className="cursor-pointer hover:text-blue-600"
                            onMouseEnter={() => setHoveredCard(companion)}
                            onMouseLeave={() => setHoveredCard(null)}
                            onMouseMove={handleMouseMove}
                        >
                            {companion.name}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-4 mb-6">
                <button onClick={() => setActiveAnalysis('manaCurve')} className={`px-4 py-2 border rounded text-xs font-bold uppercase ${activeAnalysis === 'manaCurve' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Mana Curve</button>
                <button onClick={() => setActiveAnalysis('colorCurve')} className={`px-4 py-2 border rounded text-xs font-bold uppercase ${activeAnalysis === 'colorCurve' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Color Curve</button>
            </div>

            {/* Analysis Modal Integration */}
            {activeAnalysis && (
                <DeckAnalysisModal
                    cards={deckData.card_list.mainboard}
                    onClose={() => setActiveAnalysis(null)}
                    activeTab={activeAnalysis} // Pass the active state to the modal
                />
            )}
            <div className="grid grid-cols-4 gap-6">
                {/* Main categories + Lands */}
                <div className="col-span-3 grid grid-cols-3 gap-6">
                    {Object.entries(categorizedCards)
                        .filter(([cat]) => cat !== 'Other')
                        .sort(([a], [b]) => (a === 'Lands' ? 1 : b === 'Lands' ? -1 : 0)) // Force Lands to end
                        .map(([cat, group]) => (
                            <div key={cat} className="bg-white p-4 border border-slate-200 rounded">
                                <h3 className="font-bold text-xs uppercase text-slate-500 mb-3 border-b pb-1 flex justify-between">{cat}<span>{group.totalCount}</span></h3>
                                <ul>{group.cards.map((c, i) => <li key={i} className="cursor-pointer" onMouseEnter={() => setHoveredCard(c)} onMouseLeave={() => setHoveredCard(null)} onMouseMove={handleMouseMove}>{c.name}
                                    {c.quantity > 1 && (
                <span className="text-slate-400 ml-2 font-mono">({c.quantity})</span>
            )}
                                </li>)}</ul>
                            </div>
                        ))
                    }
                </div>

                {/* Side Column for Stickers/Attractions */}
                <div className="col-span-1 sticky top-6 space-y-6">
                    {Object.entries(specialCategories).map(([cat, cards]) => (
                        <div key={cat} className="bg-slate-50 p-4 border border-slate-200 rounded">
                            <h3 className="font-bold text-xs uppercase text-slate-500 mb-3 border-b border-slate-200 pb-1">
                                {cat} ({cards.length})
                            </h3>
                            <ul>
                                {cards.sort((a, b) => a.name.localeCompare(b.name)).map((c, i) => (
                                    <li
                                        key={i}
                                        className="text-sm cursor-pointer hover:text-blue-600"
                                        onMouseEnter={() => setHoveredCard(c)}
                                        onMouseLeave={() => setHoveredCard(null)}
                                        onMouseMove={handleMouseMove}
                                    >
                                        {c.name}
                                        {c.quantity > 1 && (
                <span className="text-slate-400 ml-2 font-mono">({c.quantity})</span>
            )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                {hoveredCard && <CardPreview cardName={hoveredCard.name} imageUrl={getImageUrl(hoveredCard.printingID)} x={mousePos.x} y={mousePos.y} windowHeight={window.innerHeight} />}
            </div>
        </div>
    );
};
export default DeckDisplayTable;