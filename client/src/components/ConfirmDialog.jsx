// ConfirmDialog.jsx
import React from 'react';

// Generic credit-spend confirmation gate. No credits are spent by
// anything that shows this dialog until the user explicitly clicks
// Proceed -- Decline just closes it with no request ever sent. Used
// ahead of both Sync Decklist and Probe on UserDeckTable.
const ConfirmDialog = ({ title, estimateLabel, estimatedCost, creditsBalance, note, onProceed, onDecline, proceeding }) => {
    const creditsAfter = estimatedCost != null ? Math.max(0, creditsBalance - estimatedCost) : null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onDecline}>
            <div
                className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="font-bold text-slate-800 mb-4">{title}</h3>

                <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1 text-sm mb-4">
                    <p className="flex justify-between">
                        <span className="text-slate-500">{estimateLabel}</span>
                        <span className="font-bold text-slate-800">{estimatedCost != null ? estimatedCost : 'Unknown'}</span>
                    </p>
                    <p className="flex justify-between">
                        <span className="text-slate-500">Credits remaining after</span>
                        <span className="font-bold text-slate-800">{creditsAfter != null ? creditsAfter : '--'} / {creditsBalance} now</span>
                    </p>
                </div>

                {note && <p className="text-xs text-slate-500 mb-4">{note}</p>}

                <div className="flex gap-2">
                    <button
                        onClick={onDecline}
                        disabled={proceeding}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded text-xs font-bold uppercase text-slate-600 hover:border-slate-500 disabled:opacity-50"
                    >
                        Decline
                    </button>
                    <button
                        onClick={onProceed}
                        disabled={proceeding}
                        className="flex-1 px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                    >
                        {proceeding ? 'Working...' : 'Proceed'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
