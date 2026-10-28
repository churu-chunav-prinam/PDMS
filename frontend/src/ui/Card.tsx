import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'saffron' | 'green' | 'amber' | 'red' | 'slate';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface ring-line',
  saffron: 'bg-saffron-50 ring-saffron-200',
  green: 'bg-green-50 ring-green-200',
  amber: 'bg-amber-50 ring-amber-200',
  red: 'bg-red-50 ring-red-200',
  slate: 'bg-slate-50 ring-slate-200',
};

export const cardClass = (tone: Tone = 'neutral', pad = true) =>
  cn('rounded-card shadow-card ring-1', TONE[tone], pad && 'p-4 sm:p-5');

export function Card({ tone, pad, className, ...rest }: { tone?: Tone; pad?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardClass(tone, pad), className)} {...rest} />;
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-sm text-slate-600">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
