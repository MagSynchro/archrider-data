// CardPreview.jsx
import React from 'react';

const CardPreview = ({ cardName, imageUrl, x, y, windowHeight }) => {
  const cardHeight = 350; // Approximate height of your rendered card
  
  // Decide whether to show above or below the cursor
  const showAbove = y + cardHeight > windowHeight;
  const showLeft = x + 250 + 15 > window.innerWidth;

  return (
    <div 
      className="fixed z-50 pointer-events-none shadow-2xl rounded-lg overflow-hidden"
      style={{ 
        top: showAbove ? `${y - cardHeight - 15}px` : `${y + 15}px`, 
        left: showLeft ? `${x - 250 - 15}px` : `${x + 15}px`,
        width: '250px'
      }}
    >
      <img src={imageUrl} alt={cardName} className="w-full h-auto" />
    </div>
  );
};

export default CardPreview;