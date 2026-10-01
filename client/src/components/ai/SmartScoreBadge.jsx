import React from 'react';
import { Sparkles } from 'lucide-react';

const SmartScoreBadge = ({ score = 92, size = 'md', className = '' }) => {
  const getScoreColor = (val) => {
    if (val >= 90) return 'bg-evsathi-teal text-white border-evsathi-teal';
    if (val >= 75) return 'bg-evsathi-mint text-evsathi-dark border-evsathi-mint';
    return 'bg-evsathi-soft text-evsathi-dark border-evsathi-soft';
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold shadow-xs ${getScoreColor(
        score
      )} ${sizes[size] || sizes.md} ${className}`}
      title="Smart Score evaluated from price, distance, availability, predicted congestion & charging speed"
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span>{score} Smart Score</span>
    </span>
  );
};

export default SmartScoreBadge;
