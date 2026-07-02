// DeckAnalysisModal.jsx
import React, { useState, useEffect } from 'react';
import { calculateManaCurve, calculateColorManaCurves } from '../utils/manaUtils';

const DeckAnalysisModal = ({ cards, deckID, onClose, activeTab }) => {
    const { curve, averageCmc } = calculateManaCurve(cards);
    const colorCurves = calculateColorManaCurves(cards);

    const [manaBaseReport, setManaBaseReport] = useState(null);
    const [manaBaseError, setManaBaseError] = useState(null);
    const [manaBaseLoading, setManaBaseLoading] = useState(false);

    useEffect(() => {
        if (activeTab !== 'manaBase' || !deckID) return;

        setManaBaseLoading(true);
        setManaBaseError(null);

        fetch(`/api/decks/${deckID}/mana-base`)
            .then(res => {
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                return res.json();
            })
            .then(data => setManaBaseReport(data))
            .catch(err => setManaBaseError(err.message))
            .finally(() => setManaBaseLoading(false));
    }, [activeTab, deckID]);

    const getColorClass = (color) => ({
        W: 'bg-yellow-400', U: 'bg-blue-500', B: 'bg-slate-700',
        R: 'bg-red-500', G: 'bg-green-600', C: 'bg-slate-400'
    }[color] || 'bg-slate-400');

    const statusPill = (status) => (
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {status}
        </span>
    );

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl p-8 relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-6 text-3xl font-light">&times;</button>

                {/* Aggregate Mana Curve */}
                {activeTab === 'manaCurve' && (
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
                )}

                {activeTab === 'colorCurve' && (
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

                {activeTab === 'manaBase' && (
                    <>
                        <h2 className="text-xl font-bold mb-6">Mana Base Analysis</h2>

                        {manaBaseLoading && <p className="text-sm text-slate-500">Crunching the hypergeometric math...</p>}
                        {manaBaseError && <p className="text-sm text-red-600">Error: {manaBaseError}</p>}

                        {manaBaseReport && (
                            <>
                                {manaBaseReport.colorIdentityWarning && (
                                    <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                        {manaBaseReport.colorIdentityWarning}
                                    </div>
                                )}

                                <p className="text-xs text-slate-400 mb-6">
                                    Library size: {manaBaseReport.librarySize} &middot; Target consistency: {(manaBaseReport.config.target_consistency * 100).toFixed(0)}%
                                    &middot; Non-land source weight: {manaBaseReport.config.non_land_source_weight}
                                </p>

                                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Weighted Mana Sources</h3>
                                <div className="flex gap-4 mb-8">
                                    {manaBaseReport.weightedSources.map(s => (
                                        <div key={s.color} className={`flex-1 rounded p-3 text-center ${getColorClass(s.color)} text-white`}>
                                            <div className="text-xs font-bold uppercase opacity-90">{s.colorName}</div>
                                            <div className="text-2xl font-bold">{s.sources}</div>
                                        </div>
                                    ))}
                                </div>

                                {manaBaseReport.commanderCastability.length > 0 && (
                                    <>
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Commander Castability On Curve</h3>
                                        {manaBaseReport.commanderCastability.map(c => (
                                            <div key={c.name} className="mb-4 p-3 border border-slate-200 rounded">
                                                <div className="font-semibold text-sm mb-2">{c.name} ({c.manaCost}, CMC {c.cmc})</div>
                                                <div className="flex gap-3 flex-wrap">
                                                    {c.perColor.map(pc => (
                                                        <div key={pc.color} className="text-xs flex items-center gap-2">
                                                            <span className={`w-3 h-3 rounded-full ${getColorClass(pc.color)}`}></span>
                                                            {pc.colorName} (need {pc.pipsNeeded}): {(pc.probability * 100).toFixed(1)}% {statusPill(pc.status)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2 mt-6">Reference Thresholds</h3>
                                {manaBaseReport.referenceThresholds.map(rt => (
                                    <div key={rt.color} className="mb-4">
                                        <div className="font-semibold text-sm mb-1">{rt.colorName} ({rt.sources} sources in deck)</div>
                                        <table className="text-xs w-full">
                                            <thead>
                                                <tr className="text-slate-400 text-left">
                                                    <th className="font-normal pr-4">Turn</th>
                                                    <th className="font-normal pr-4">Single pip needs</th>
                                                    <th className="font-normal pr-4">Turn</th>
                                                    <th className="font-normal pr-4">Double pip needs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rt.singlePip.map((sp, i) => (
                                                    <tr key={i}>
                                                        <td className="pr-4">{sp.turn}</td>
                                                        <td className="pr-4">{sp.sourcesNeeded ?? 'N/A'} {statusPill(sp.status)}</td>
                                                        <td className="pr-4">{rt.doublePip[i]?.turn ?? ''}</td>
                                                        <td className="pr-4">
                                                            {rt.doublePip[i] ? (<>{rt.doublePip[i].sourcesNeeded ?? 'N/A'} {statusPill(rt.doublePip[i].status)}</>) : ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DeckAnalysisModal;