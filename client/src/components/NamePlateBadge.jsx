//NamePlateBadge.jsx
import React from 'react';
import { getDynamicGradientStyle } from '../utils/gradientUtils';
import { getColorIdentityName } from '../utils/colorUtils';

const NameplateBadge = ({ identity }) => {
  // 1. Parse the array using your existing utility
  const identityName = getColorIdentityName(identity);
  // 2. Get the gradient background
    
  const style = getDynamicGradientStyle(identity, identityName);

  return (
    <div 
      className="inline-flex items-center justify-center w-[20ch] h-[28px] rounded-full border border-black/20 shadow-lg overflow-hidden"
      style={{ background: style.background || style.backgroundColor }}
    >
      {/* The Visor: A semi-transparent black strip that ensures readability */}
      <div className="w-full h-full flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
        <span className="nameplate-font text-[11px] font-bold uppercase tracking-widest text-white drop-shadow-md text-center">
          {identityName}
        </span>
      </div>
    </div>
  );
};

export default NameplateBadge;