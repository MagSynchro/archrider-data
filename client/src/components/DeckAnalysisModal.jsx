// DeckAnalysisModal.jsx
import React from 'react';
import { calculateManaCurve, calculateColorManaCurves } from '../utils/manaUtils';

const DeckAnalysisModal = ({ cards, onClose, activeTab }) => {
    const { curve, averageCmc } = calculateManaCurve(cards);
    const colorCurves = calculateColorManaCurves(cards);
    

    const getColorClass = (color) => ({
        W: 'bg-yellow-400', U: 'bg-blue-500', B: 'bg-slate-700',
        R: 'bg-red-500', G: 'bg-green-600', C: 'bg-slate-400'
    }[color] || 'bg-slate-400');

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-8 relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-6 text-3xl font-light">&times;</button>

                {/* Aggregate Mana Curve */}
                {activeTab === 'manaCurve' ? (
                    <>
                        <h2 className="text-xl font-bold mb-6">Mana Curve (Avg: {averageCmc})</h2>
                        <div className="flex items-end gap-2 h-48 border-b border-slate-200 pb-2 mb-10">
                            {curve.map((item) => (
                                <div key={item.cmc} className="flex-1 flex flex-col items-center justify-end h-full relative">
                                    {item.count > 0 && <span className="text-[10px] text-slate-400 font-medium mb-1">{item.count}</span>}
                                    <div className="w-full bg-orange-500 opacity-80 rounded-t" style={{ height: `${(item.count / 25) * 100}%` }} />
                                    <span className="text-xs font-bold text-slate-500 mt-2">{item.cmc}</span>
                                </div>
                            ))}
                        </div>

                    </>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-6">Mana Curve by Color</h2>
                        <div className="grid grid-cols-6 gap-4">
                            {Object.entries(colorCurves).map(([color, data]) => (
                                <div key={color} className="space-y-2">
                                    <h4 className="font-bold text-center text-sm">{color}</h4>
                                    <div className="flex items-end gap-1 h-32 border-b border-slate-200">
                                        {data.map((item) => (
                                            <div key={item.cmc} className="flex-1 flex flex-col items-center justify-end h-full relative">
                                                {item.count > 0 && <span className="text-[10px] text-slate-400 font-medium mb-1">{item.count}</span>}
                                                <div className={`w-full rounded-t ${getColorClass(color)}`} style={{ height: `${(item.count / 10) * 100}%` }} />
                                                <span className="text-[9px] mt-1">{item.cmc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        </>
                )}
                    </div>
            </div>
            );
};
            export default DeckAnalysisModal;