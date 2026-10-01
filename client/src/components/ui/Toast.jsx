import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ type = 'success', message, onClose }) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
    error: 'border-rose-200 bg-rose-50/90 text-rose-900',
    warning: 'border-amber-200 bg-amber-50/90 text-amber-900',
    info: 'border-sky-200 bg-sky-50/90 text-sky-900',
  };

  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-md transition-all duration-200 ${borders[type] || borders.info}`}
      role="alert"
    >
      {icons[type] || icons.info}
      <span className="text-sm font-medium pr-2">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors ml-auto"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Toast;
