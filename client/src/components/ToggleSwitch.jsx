// ToggleSwitch.jsx
import React from 'react';

// Generic slide/pill boolean toggle with optional labels on either side.
const ToggleSwitch = ({ checked, onChange, labelOff, labelOn }) => (
    <div className="flex items-center gap-2">
        {labelOff && (
            <span className={`text-xs font-bold uppercase ${!checked ? 'text-slate-800' : 'text-slate-400'}`}>
                {labelOff}
            </span>
        )}
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-slate-800' : 'bg-slate-300'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
        {labelOn && (
            <span className={`text-xs font-bold uppercase ${checked ? 'text-slate-800' : 'text-slate-400'}`}>
                {labelOn}
            </span>
        )}
    </div>
);

export default ToggleSwitch;
