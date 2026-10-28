import { ChevronLeft, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { cn } from '../ui';

/** Sticky top bar: back, title (+ subtitle), logout. Tricolour hairline on top. */
export function TopBar({ title, subtitle, back, className, extra, narrow = false }: { title: string; subtitle?: string; back?: string; className?: string; extra?: ReactNode; narrow?: boolean }) {
  const { user, logout } = useAuth();
  return (
    <header className={cn('topbar sticky top-0 z-30 bg-saffron-700 text-white shadow-md', className)}>
      <div className="tricolour h-1" aria-hidden="true" />
      <div className={cn('mx-auto flex min-h-14 items-center gap-2 px-2 sm:px-4', narrow ? 'max-w-xl' : 'max-w-6xl')}>
        {back !== undefined && (
          <a href={`#${back}`} aria-label="वापस / Back" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/15">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </a>
        )}
        <div className={cn('min-w-0 flex-1', back === undefined && 'pl-2')}>
          <div className="truncate text-lg font-bold leading-tight">{title}</div>
          {subtitle && <div className="truncate text-xs text-white/85">{subtitle}</div>}
        </div>
        {extra}
        {user && (
          <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 ring-white/50 hover:bg-white/15">
            <LogOut className="size-4" aria-hidden="true" />
            लॉग आउट
          </button>
        )}
      </div>
    </header>
  );
}
