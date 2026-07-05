// CardDetailModal.jsx
import React from 'react';

// Same 5 fixed bracket-template buckets as the backend's
// VALID_NORMALIZED_CATEGORIES (src/controllers/deckController.js).
const CATEGORY_OPTIONS = [
    { value: 'RAMP', label: 'Ramp' },
    { value: 'TARGETED_INT', label: 'Targeted Interaction' },
    { value: 'MASS_INT', label: 'Mass Interaction' },
    { value: 'CARD_DRAW', label: 'Card Draw' },
    { value: 'SYNERGY', label: 'Synergy' }
];

// Modal shown on card click. Always shows oracle text; the category
// override editor is an additional pane (rendered to its right) only in
// the ArchRider view -- overrides are about our taxonomy, so editing
// them while looking at Archidekt's own categories would be confusing.
// Parent owns the fetch calls; this component only reports the user's choice.
//
// coreSynergyOptions ({ value, label }[]) -- the deck's own chosen core
// synergies (see migration 021), offered as additional, more specific
// override targets alongside the 5 broad buckets. A card can be
// taxonomy-derived as RAMP but still genuinely care about, say, mana
// value (e.g. Clement, the Worrywort's bounce trigger) -- this lets a
// user tag it into that specific synergy instead of only the broad
// "Synergy" bucket. onSelect(normalizedCategory, cardCategory) -- the
// broad buttons omit cardCategory (unchanged prior behavior); the core
// synergy buttons always pass 'SYNERGY' + the specific code.
const CardDetailModal = ({ card, showCategoryEditor, saving, onSelect, onClear, onClose, coreSynergyOptions = [] }) => {
    const coreSynergyValues = coreSynergyOptions.map(opt => opt.value);
    // The broad "Synergy" button should only look active for a SYNERGY
    // card that ISN'T one of the deck's specific core synergies -- so
    // exactly one button is ever highlighted, not two at once.
    const isBroadSynergyActive = card.normalized_category === 'SYNERGY' && !coreSynergyValues.includes(card.card_category);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className={`bg-white rounded-lg shadow-2xl w-full p-6 relative flex gap-6 ${showCategoryEditor ? 'max-w-2xl' : 'max-w-md'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-3 right-4 text-2xl font-light">&times;</button>

                <div className={`min-w-0 ${showCategoryEditor ? 'flex-1 border-r border-slate-200 pr-6' : 'flex-1'}`}>
                    <h3 className="font-bold text-slate-800 mb-1">{card.name}</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Oracle Text</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                        {card.oracleText || 'No oracle text available.'}
                    </p>
                </div>

                {showCategoryEditor && (
                    <div className="w-56 shrink-0">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Set category override</p>
                        <div className="space-y-2">
                            {CATEGORY_OPTIONS.map(opt => {
                                const isActive = opt.value === 'SYNERGY' ? isBroadSynergyActive : card.normalized_category === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        disabled={saving}
                                        onClick={() => onSelect(opt.value)}
                                        className={`w-full text-left px-3 py-2 rounded border text-sm font-medium disabled:opacity-50 ${
                                            isActive
                                                ? 'bg-slate-800 text-white border-slate-800'
                                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>

                        {coreSynergyOptions.length > 0 && (
                            <>
                                <p className="text-xs text-slate-400 uppercase tracking-wider mt-4 mb-2">Or tag as a core synergy</p>
                                <div className="space-y-2">
                                    {coreSynergyOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            disabled={saving}
                                            onClick={() => onSelect('SYNERGY', opt.value)}
                                            className={`w-full text-left px-3 py-2 rounded border text-sm font-medium disabled:opacity-50 ${
                                                card.card_category === opt.value
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {card.isOverridden && (
                            <button
                                disabled={saving}
                                onClick={onClear}
                                className="w-full mt-4 px-3 py-2 rounded border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                Clear override
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CardDetailModal;
