import { getDynamicGradientStyle } from '../utils/gradientUtils';
import { getColorIdentityName } from '../utils/colorUtils';

const ColorBadge = ({ colorString }) => {
  // Get the name (e.g., "TEMUR") and the dynamic style object
  const identityName = getColorIdentityName(colorString);
  const style = getDynamicGradientStyle(colorString);

  return (
<span 
      style={style} 
      className="
        inline-flex items-center justify-center 
        w-[20ch] h-[24px] 
        rounded-full border-2 border-white/20 
        shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),0_1px_3px_rgba(0,0,0,0.3)] 
        font-bold text-[10px] uppercase tracking-wider text-center 
        backdrop-blur-sm
      "
    >
      {identityName}
    </span>
  );
};

export default ColorBadge;