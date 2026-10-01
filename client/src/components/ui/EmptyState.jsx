import React from 'react';
import { SearchX } from 'lucide-react';
import Button from './Button.jsx';

const EmptyState = ({
  icon: Icon = SearchX,
  title = 'No results found',
  description = 'Try adjusting your search criteria or clearing your filters to see more results.',
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-3xl ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-inner">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-slate-500 text-sm max-w-md mb-6">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
