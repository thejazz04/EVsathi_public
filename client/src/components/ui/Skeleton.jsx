import React from 'react';

export const Skeleton = ({ className = '', variant = 'text', width, height }) => {
  const baseClasses = 'animate-pulse bg-slate-200/90 rounded-xl';
  
  const variants = {
    text: 'h-4 w-full rounded-md',
    title: 'h-6 w-3/4 rounded-lg',
    avatar: 'h-10 w-10 rounded-full shrink-0',
    card: 'h-48 w-full rounded-2xl',
    button: 'h-10 w-28 rounded-xl',
  };

  const style = {
    width: width ? width : undefined,
    height: height ? height : undefined,
  };

  return <div className={`${baseClasses} ${variants[variant] || ''} ${className}`} style={style} />;
};

export const ChargerCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card space-y-4">
    <Skeleton variant="card" className="h-44" />
    <div className="space-y-2">
      <Skeleton variant="title" />
      <Skeleton variant="text" width="60%" />
    </div>
    <div className="flex items-center justify-between pt-2">
      <Skeleton variant="button" />
      <Skeleton variant="text" width="30%" />
    </div>
  </div>
);

export const DashboardCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-3">
    <div className="flex justify-between items-center">
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="avatar" className="w-8 h-8 rounded-lg" />
    </div>
    <Skeleton variant="title" className="h-8 w-1/2" />
    <Skeleton variant="text" width="70%" />
  </div>
);

export default Skeleton;
