import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export type ButtonVariant = 'navy' | 'orange' | 'blue' | 'ghost' | 'danger';

const variantStyles: Record<ButtonVariant, string> = {
  navy: 'bg-[var(--navy)] text-white hover:bg-black',
  orange: 'bg-[var(--coral)] text-white hover:bg-[var(--orange)]',
  blue: 'bg-[var(--blue)] text-white hover:bg-[var(--blue-deep)]',
  ghost: 'bg-white text-[var(--navy)] border border-[var(--line)] hover:bg-[var(--sun-soft)]',
  danger: 'bg-white text-[var(--danger)] border border-[var(--danger)] hover:bg-red-50',
};

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'navy',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={loading || disabled ? undefined : { y: -2 }}
      whileTap={loading || disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={loading || disabled}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.button>
  );
}
