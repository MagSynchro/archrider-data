// CategoryPicker.jsx
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

// Modal for manually overriding a card's deck-scoped category.
// Parent owns the fetch calls; this component only reports the user's choice.
const CategoryPicker = ({ card, saving, onSelect, onClear, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-3 right-4 text-2xl font-light">&times;</button>
                <h3 className="font-bold text-slate-800 mb-1">{card.name}</h3>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Set category override</p>

                <div className="space-y-2">
                    {CATEGORY_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            disabled={saving}
                            onClick={() => onSelect(opt.value)}
                            className={`w-full text-left px-3 py-2 rounded border text-sm font-medium disabled:opacity-50 ${
                                card.normalized_category === opt.value
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

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
        </div>
    );
};

export default CategoryPicker;
