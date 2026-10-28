import type { ReactNode } from 'react';
import { cn } from './cn';
import type { Tone } from './Card';

const TONE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  saffron: 'bg-saffron-50 text-saffron-800 ring-saffron-200',
  green: 'bg-green-50 text-green-800 ring-green-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
};
const DOT: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  slate: 'bg-slate-400',
  saffron: 'bg-saffron-600',
  green: 'bg-green-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};

/** Status pill: tone + optional icon. */
export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', DOT[tone])} role="img" aria-label={label} />;
}
