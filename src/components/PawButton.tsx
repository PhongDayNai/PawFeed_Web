import React from 'react';

interface PawButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'link';
  loading?: boolean;
}

export function PawButton({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}: PawButtonProps) {
  const buttonClass = `btn btn-${variant} ${className}`;

  return (
    <button
      className={buttonClass}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}
