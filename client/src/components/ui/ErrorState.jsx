import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button.jsx';

const ErrorState = ({
  title = 'Something went wrong',
  message = 'Unable to load the requested information right now. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`p-8 bg-rose-50/70 border border-rose-200/80 rounded-3xl text-center flex flex-col items-center justify-center ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-lg font-bold text-rose-950 mb-1">{title}</h4>
      <p className="text-sm text-rose-700 max-w-md mb-5">{message}</p>
      {onRetry && (
        <Button variant="danger" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
