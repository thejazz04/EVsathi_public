import React from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconPosition = 'left',
  className = '',
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none';

  const variants = {
    primary: 'bg-evsathi-teal text-white hover:bg-[#547b71] active:bg-[#45665e] focus:ring-evsathi-teal shadow-xs shadow-evsathi-teal/20',
    secondary: 'bg-evsathi-soft text-evsathi-dark hover:bg-evsathi-mint active:bg-evsathi-mint focus:ring-evsathi-mint border border-evsathi-mint/40',
    outline: 'border-2 border-evsathi-teal text-evsathi-teal hover:bg-evsathi-soft/40 active:bg-evsathi-soft focus:ring-evsathi-teal',
    ghost: 'bg-transparent text-evsathi-slate hover:bg-evsathi-soft/40 hover:text-evsathi-dark active:bg-evsathi-soft/60 focus:ring-evsathi-teal',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-500 shadow-xs shadow-rose-600/20',
    dark: 'bg-evsathi-dark text-white hover:bg-evsathi-slate active:bg-[#121c19] focus:ring-evsathi-dark shadow-md',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : Icon && iconPosition === 'left' ? (
        <Icon className="w-4 h-4" />
      ) : null}
      
      {children}

      {!loading && Icon && iconPosition === 'right' ? (
        <Icon className="w-4 h-4" />
      ) : null}
    </button>
  );
};

export default Button;
