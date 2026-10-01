import React from 'react';

const Badge = ({
  children,
  variant = 'success',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variants = {
    success: 'bg-evsathi-soft/70 text-evsathi-dark border-evsathi-mint/60',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-800 border-rose-200/80',
    info: 'bg-sky-50 text-sky-800 border-sky-200/80',
    neutral: 'bg-evsathi-surface text-evsathi-slate border-evsathi-soft/60',
    brand: 'bg-evsathi-teal text-white border-evsathi-teal shadow-xs',
    mint: 'bg-evsathi-mint text-evsathi-dark border-evsathi-mint shadow-xs',
  };

  const dotColors = {
    success: 'bg-evsathi-teal',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    neutral: 'bg-evsathi-muted',
    brand: 'bg-white',
    mint: 'bg-evsathi-dark',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px] font-semibold',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${variants[variant] || variants.neutral} ${
        sizes[size] || sizes.md
      } ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant] || dotColors.neutral}`} />}
      {children}
    </span>
  );
};

export default Badge;
