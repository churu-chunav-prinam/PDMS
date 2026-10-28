import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-line-strong px-4 py-10 text-center">
      <Icon className="size-10 text-slate-400" aria-hidden="true" />
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="text-sm text-slate-600">{children}</div>}
    </div>
  );
}

/** Grey placeholder blocks while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200/80', className)} aria-hidden="true" />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="लोड हो रहा है">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-20" />)}
    </div>
  );
}
