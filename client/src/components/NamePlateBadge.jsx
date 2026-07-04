//NamePlateBadge.jsx
import React from 'react';
import { getDynamicGradientStyle } from '../utils/gradientUtils';
import { getColorIdentityName } from '../utils/colorUtils';

// approximate: true when this color identity came from the cheap
// deck-listing "colors" approximation rather than a full probe (i.e. the
// deck's last_synced is still null) -- see deckSync.js. Rendered as a
// trailing "?" so the UI never implies more confidence in the identity
// than the underlying data actually has.
const NameplateBadge = ({ identity, approximate = false }) => {
  // 1. Parse the array using your existing utility
  const identityName = getColorIdentityName(identity);
  // 2. Get the gradient background

  const style = getDynamicGradientStyle(identity, identityName);

  return (
    <div
      className="inline-flex items-center justify-center w-[20ch] h-[28px] rounded-full border border-black/20 shadow-lg overflow-hidden"
      style={{ background: style.background || style.backgroundColor }}
      title={approximate ? 'Approximate -- not yet confirmed by a full sync' : undefined}
    >
      {/* The Visor: A semi-transparent black strip that ensures readability */}
      <div className="w-full h-full flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
        <span className="nameplate-font text-[11px] font-bold uppercase tracking-widest text-white drop-shadow-md text-center">
          {identityName}{approximate && '?'}
        </span>
      </div>
    </div>
  );
};

export default NameplateBadge;