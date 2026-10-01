import React from 'react';

export const Card = ({ children, className = '', hover = true, ...props }) => {
  const hasBg = className.includes('bg-');
  const baseBg = hasBg ? '' : 'bg-white';

  return (
    <div
      className={`${baseBg} rounded-2xl border border-evsathi-mint/40 shadow-evsathi p-6 transition-all duration-200 ${
        hover ? 'hover:shadow-evsathi-hover hover:-translate-y-0.5' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }) => (
  <h3 className={`text-lg font-bold text-evsathi-dark tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-sm text-evsathi-slate mt-1 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`mt-6 pt-4 border-t border-evsathi-soft/60 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
