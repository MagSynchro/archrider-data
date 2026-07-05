//DeckDisplayTable.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NameplateBadge from './NamePlateBadge';
import BracketBadge from './BracketBadge';
import CardPreview from './CardPreview';
import DeckAnalysisModal from './DeckAnalysisModal'; // New Import
import CardDetailModal from './CardDetailModal';
import ToggleSwitch from './ToggleSwitch';
import { getCardTypeBucket } from '../utils/cardTypeUtils';

// Friendly labels for the five fixed bracket-template buckets.
// Anything else (fine-grained card_category codes, or the type-line
// fallback bucket) is humanized generically below.
const NORMALIZED_CATEGORY_LABELS = {
    RAMP: 'Ramp',
    TARGETED_INT: 'Targeted Interaction',
    MASS_INT: 'Mass Interaction',
    CARD_DRAW: 'Card Draw',
    SYNERGY: 'Synergy'
};

// "MANA_DORK" -> "Mana Dork", "SYN_TYPAL" -> "Typal"
const humanizeCategoryCode = (code) =>
    code
        .replace(/^SYN_/, '')
        .split('_')
        .filter(Boolean)
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');

// Grouping fallback chain, per design decision: normalized_category first
// (the 5 clean bracket-template buckets), then card_category (fine-grained),
// then a coarse card-type bucket derived from type_line, then a final
// catch-all.
//
// coreSynergies (a Set of card_category strings, empty if the deck hasn't
// designated any) narrows the broad SYNERGY bucket: a card whose
// card_category matches one of the deck's chosen synergies gets its own
// "Core Synergy: X" group; everything else that's SYNERGY-classified but
// doesn't match falls back through card_category_secondary (a genuinely
// different runner-up category, see migration 021) before finally
// dropping to a raw card-type bucket -- rather than everything just
// piling into one generic "Synergy" group regardless of relevance. When
// no core synergy is chosen at all, behavior is unchanged from before
// this feature existed.
const getGroupLabel = (card, coreSynergies) => {
    if (card.normalized_category === 'SYNERGY' && coreSynergies && coreSynergies.size > 0) {
        if (coreSynergies.has(card.card_category)) {
            return `Core Synergy: ${humanizeCategoryCode(card.card_category)}`;
        }
        // Also matches via the secondary category -- e.g. a card whose
        // primary tag is SYN_DISCARD but whose runner-up is SYN_SAC_OUTLET
        // still belongs with the deck's declared Sac Outlet theme. Without
        // this check it would land in a bare "Sac Outlet" bucket instead,
        // confusingly distinct from "Core Synergy: Sac Outlet".
        if (card.card_category_secondary && coreSynergies.has(card.card_category_secondary)) {
            return `Core Synergy: ${humanizeCategoryCode(card.card_category_secondary)}`;
        }
        if (card.card_category_secondary) {
            return humanizeCategoryCode(card.card_category_secondary);
        }
        const typeBucket = getCardTypeBucket(card.type_line);
        if (typeBucket) return typeBucket;
        return 'Uncategorized';
    }

    if (card.normalized_category) {
        return NORMALIZED_CATEGORY_LABELS[card.normalized_category]
            || humanizeCategoryCode(card.normalized_category);
    }
    if (card.card_category) {
        return humanizeCategoryCode(card.card_category);
    }
    const typeBucket = getCardTypeBucket(card.type_line);
    if (typeBucket) return typeBucket;

    return 'Uncategorized';
};

// Archidekt view: group by the deck owner's own raw per-card categories
// instead of our derived taxonomy. Display-only -- per CLAUDE.md these
// free-text categories are unreliable for anything programmatic, so this
// exists purely so a user can eyeball Archidekt's opinion vs. ours, not
// as a data source.
const getArchidektGroupLabel = (card) => {
    const categories = (card.categories || []).filter(Boolean);
    return categories[0] || 'Uncategorized';
};

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
    const [detailCard, setDetailCard] = useState(null);
    const [savingOverride, setSavingOverride] = useState(false);
    // Defaults to Archidekt's own categories. Once user registration/deck
    // ownership exists (see HANDOFF.md), this default should come from the
    // logged-in user's saved preference instead of a hardcoded false.
    const [isArchRiderView, setIsArchRiderView] = useState(false);

    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    const getImageUrl = (pid) => `https://cards.scryfall.io/normal/front/${pid[0]}/${pid[1]}/${pid}.jpg`;

    const loadDeck = () => {
        fetch(`/api/decks/${deckID}`)
            .then(res => res.json())
            .then(data => setDeckData(data));
    };

    useEffect(() => {
        loadDeck();
    }, [deckID]);

    // Regroups from the already-fetched deck data whenever the raw data or
    // the view toggle changes -- no refetch needed to switch views.
    useEffect(() => {
        if (!deckData) return;

        const coreSynergySet = new Set(deckData.coreSynergies || []);
        const groupLabelFor = isArchRiderView
            ? (card) => getGroupLabel(card, coreSynergySet)
            : getArchidektGroupLabel;

        //1. Seperate cards into mainboard and sideboard
        const mainboard = deckData.card_list.mainboard || [];
        const sideboard = deckData.card_list.sideboard || [];
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
            const cat = groupLabelFor(card);
            if (!acc[cat]) acc[cat] = { cards: [], totalCount: 0 };
            acc[cat].cards.push(card);
            acc[cat].totalCount += (card.quantity || 1);
            return acc;
        }, {});

        // 3. Add Lands and Others as "Special Groups"
        if (lands.length > 0) groups['Lands'] = { cards: lands, totalCount: lands.reduce((sum, c) => sum + (c.quantity || 1), 0) };
        setSpecialCategories(specials);
        setCategorizedCards(groups);
    }, [deckData, isArchRiderView]);

    // cardCategory is optional -- the 5 broad category buttons omit it
    // (unchanged prior behavior); CardDetailModal's core-synergy buttons
    // pass 'SYNERGY' + the deck's specific chosen code, so a card can be
    // tagged into that theme even if its taxonomy-derived category is
    // something else entirely (e.g. Clement, the Worrywort is RAMP by
    // default but genuinely cares about mana value too).
    const handleSelectCategory = (normalizedCategory, cardCategory = null) => {
        setSavingOverride(true);
        fetch(`/api/decks/${deckID}/cards/${detailCard.oracleID}/category`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ normalized_category: normalizedCategory, card_category: cardCategory })
        })
            .then(res => {
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                loadDeck();
                setDetailCard(null);
            })
            .catch(err => console.error('Failed to set category override:', err.message))
            .finally(() => setSavingOverride(false));
    };

    const handleClearOverride = () => {
        setSavingOverride(true);
        fetch(`/api/decks/${deckID}/cards/${detailCard.oracleID}/category`, { method: 'DELETE' })
            .then(res => {
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                loadDeck();
                setDetailCard(null);
            })
            .catch(err => console.error('Failed to clear category override:', err.message))
            .finally(() => setSavingOverride(false));
    };

    // Adds/removes one of this deck's chosen "core synergy" categories
    // (see migration 021) -- reloads the deck afterward so both the
    // checkbox state and the regrouped card lists reflect the change.
    const handleToggleCoreSynergy = (category, isSelected) => {
        const request = isSelected
            ? fetch(`/api/decks/${deckID}/core-synergies/${category}`, { method: 'DELETE' })
            : fetch(`/api/decks/${deckID}/core-synergies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ card_category: category })
            });

        request
            .then(res => {
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                loadDeck();
            })
            .catch(err => console.error('Failed to update core synergy:', err.message));
    };

    if (!deckData) return <div className="p-10 text-center">Loading deck library...</div>;

    const coreSynergySet = new Set(deckData.coreSynergies || []);

    // Candidate core synergies for the selector: distinct SYNERGY
    // card_category values actually present among this deck's own
    // (non-commander) cards, with a count -- not every SYN_* category
    // that exists globally.
    const synergyCounts = {};
    (deckData.card_list.mainboard || []).forEach(c => {
        if (!c.isCommander && c.normalized_category === 'SYNERGY' && c.card_category) {
            synergyCounts[c.card_category] = (synergyCounts[c.card_category] || 0) + (c.quantity || 1);
        }
    });
    const availableSynergies = Object.entries(synergyCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => ({ category, count }));

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8 border-b border-slate-200 pb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800">{deckData.name}<BracketBadge level={deckData.edh_bracket} /></h1>                    
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

            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-4">
                    <button onClick={() => setActiveAnalysis('manaCurve')} className={`px-4 py-2 border rounded text-xs font-bold uppercase ${activeAnalysis === 'manaCurve' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Mana Curve</button>
                    <button onClick={() => setActiveAnalysis('colorCurve')} className={`px-4 py-2 border rounded text-xs font-bold uppercase ${activeAnalysis === 'colorCurve' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Color Curve</button>
                    <button onClick={() => setActiveAnalysis('manaBase')} className={`px-4 py-2 border rounded text-xs font-bold uppercase ${activeAnalysis === 'manaBase' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Mana Base</button>
                </div>
                <ToggleSwitch checked={isArchRiderView} onChange={setIsArchRiderView} labelOff="Archidekt" labelOn="ArchRider" />
            </div>

            {/* Core synergy selector -- ArchRider view only, and only when
                the deck actually has SYNERGY-classified cards to choose
                from. Picking one or more narrows those cards out of the
                generic "Synergy" pile into their own specific group(s);
                see getGroupLabel above. */}
            {isArchRiderView && availableSynergies.length > 0 && (
                <div className="mb-6 p-4 bg-white border border-slate-200 rounded">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-1">Core Synergies</h3>
                    <p className="text-xs text-slate-400 mb-3">
                        Choose this deck's actual build-around theme(s) to split them out from the generic Synergy group.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {availableSynergies.map(({ category, count }) => {
                            const selected = coreSynergySet.has(category);
                            return (
                                <label
                                    key={category}
                                    className={`flex items-center gap-1.5 text-xs px-2 py-1 border rounded cursor-pointer ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => handleToggleCoreSynergy(category, selected)}
                                    />
                                    {humanizeCategoryCode(category)} ({count})
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Analysis Modal Integration */}
            {activeAnalysis && (
                <DeckAnalysisModal
                    cards={deckData.card_list.mainboard}
                    deckID={deckID}
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
                                <ul>{group.cards.map((c, i) => <li key={i} className="cursor-pointer" onClick={() => setDetailCard(c)} onMouseEnter={() => setHoveredCard(c)} onMouseLeave={() => setHoveredCard(null)} onMouseMove={handleMouseMove}>
                                    {isArchRiderView && c.isOverridden && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" title="Manually categorized" />}
                                    {c.name}
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

            {detailCard && (
                <CardDetailModal
                    card={detailCard}
                    showCategoryEditor={isArchRiderView}
                    saving={savingOverride}
                    onSelect={handleSelectCategory}
                    onClear={handleClearOverride}
                    onClose={() => setDetailCard(null)}
                    coreSynergyOptions={(deckData.coreSynergies || []).map(category => ({ value: category, label: humanizeCategoryCode(category) }))}
                />
            )}
        </div>
    );
};
export default DeckDisplayTable;