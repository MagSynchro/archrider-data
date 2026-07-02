// BracketBadge.jsx
const BRACKET_LABELS = {
  1: { label: 'Exhibition', color: 'bg-gray-100 text-gray-800', border: 'border-gray-100' },
  2: { label: 'Core', color: 'bg-blue-100 text-blue-800', border: 'border-blue-100' },
  3: { label: 'Upgraded', color: 'bg-green-100 text-green-800', border: 'border-green-100' },
  4: { label: 'Optimized', color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-100' },
  5: { label: 'Competitive', color: 'bg-red-100 text-red-800', border: 'border-red-100' },
  null: { label: 'Unassigned', color: 'bg-slate-50 text-slate-400', border: 'border-slate-100' },
};

const BracketBadge = ({ level }) => {
  const config = BRACKET_LABELS[level] || BRACKET_LABELS[1];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} ${config.border}`}>
      {config.label} ({level})
    </span>
  );
};

export default BracketBadge;