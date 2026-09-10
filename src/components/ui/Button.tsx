import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--primary, #176B52)',
          color: '#FFFFFF',
          border: '1px solid var(--primary, #176B52)',
          boxShadow: '0 1px 2px rgba(23, 107, 82, 0.2)'
        };
      case 'outline':
      case 'secondary':
        return {
          backgroundColor: 'var(--surface, #FFFFFF)',
          color: 'var(--text-primary, #1A2E26)',
          border: '1px solid var(--border, #E2E8E5)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
        };
      case 'danger':
        return {
          backgroundColor: '#DC2626',
          color: '#FFFFFF',
          border: '1px solid #DC2626',
          boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)'
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary, #64748B)',
          border: '1px solid transparent'
        };
      case 'success':
        return {
          backgroundColor: '#16A34A',
          color: '#FFFFFF',
          border: '1px solid #16A34A',
          boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)'
        };
      case 'gold':
        return {
          backgroundColor: 'var(--gold, #C9A227)',
          color: '#0F2020',
          border: '1px solid var(--gold, #C9A227)',
          fontWeight: 700
        };
      default:
        return {};
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          height: '32px',
          padding: '0 10px',
          fontSize: '11.5px',
          gap: '5px',
          borderRadius: 'var(--radius-md, 8px)'
        };
      case 'lg':
        return {
          height: '44px',
          padding: '0 20px',
          fontSize: '14px',
          gap: '8px',
          borderRadius: 'var(--radius-md, 10px)'
        };
      case 'md':
      default:
        return {
          height: '38px',
          padding: '0 14px',
          fontSize: '12.5px',
          gap: '6px',
          borderRadius: 'var(--radius-md, 8px)'
        };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.65 : 1,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    width: fullWidth ? '100%' : 'auto',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style
  };

  return (
    <button
      className={`btn btn-${variant} ${className}`}
      style={baseStyles}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 size={size === 'sm' ? 12 : 14} className="spin-animation" />
          {children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
};
