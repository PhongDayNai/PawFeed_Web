import React from 'react';

interface PawCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export function PawCard({ children, hoverable = true, className = '', ...props }: PawCardProps) {
  return (
    <div
      className={`glass ${hoverable ? 'glass-card-hover' : ''} ${className}`}
      style={{ padding: '24px' }}
      {...props}
    >
      {children}
    </div>
  );
}
