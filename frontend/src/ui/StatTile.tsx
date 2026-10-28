import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import type { Tone } from './Card';

const TONE: Partial<Record<Tone, string>> = {
  neutral: 'bg-surface ring-line text-slate-900',
  green: 'bg-green-50 ring-green-200 text-green-900',
  red: 'bg-red-50 ring-red-200 text-red-900',
  saffron: 'bg-saffron-50 ring-saffron-200 text-saffron-800',
};
const ICON: Partial<Record<Tone, string>> = {
  neutral: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  saffron: 'bg-saffron-100 text-saffron-800',
};

export function StatTile({ icon: Icon, value, hi, en, tone = 'neutral', className }: { icon: LucideIcon; value: string; hi: string; en: string; tone?: Tone; className?: string }) {
  return (
    <div className={cn('stat flex flex-col gap-2 rounded-card p-4 shadow-card ring-1', TONE[tone], className)}>
      <span className={cn('grid size-9 place-items-center rounded-lg', ICON[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="text-3xl font-extrabold tabular-nums leading-none">{value}</span>
      <span className="text-sm font-semibold leading-tight">
        {hi}
        <span className="block text-xs font-normal opacity-80">{en}</span>
      </span>
    </div>
  );
}
