import { Loader2 } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-saffron-700 text-white hover:bg-saffron-800 shadow-sm',
  secondary: 'bg-white text-saffron-800 ring-1 ring-inset ring-line-strong hover:bg-saffron-50',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
  success: 'bg-green-700 text-white hover:bg-green-800 shadow-sm',
  ghost: 'text-slate-700 hover:bg-slate-100',
};
// Every size keeps a 44px+ tap target.
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm gap-1.5',
  md: 'min-h-12 px-4 text-base gap-2',
  lg: 'min-h-14 px-5 text-lg gap-2.5',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) {
  return cn(
    'inline-flex items-center justify-center rounded-xl font-semibold transition-colors select-none',
    'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
  );
}

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn(buttonClass(variant, size, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

/** A link that looks like a button (hash routes). */
export function LinkButton({ variant, size, block, icon, className, children, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cn(buttonClass(variant, size, block), className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}
