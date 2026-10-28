import { AlertTriangle, CheckCircle2, Pencil, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HistoryEvent, IssueType } from '../api/types';
import { ISSUE_LABELS, dayTimeOf } from '../labels';
import { cn } from '../ui';

const KIND: Record<HistoryEvent['kind'], { label: string; Icon: LucideIcon; dot: string }> = {
  REPORT: { label: 'दर्ज', Icon: CheckCircle2, dot: 'bg-green-700' },
  EDIT: { label: 'संशोधन', Icon: Pencil, dot: 'bg-amber-600' },
  ISSUE_OPEN: { label: 'समस्या', Icon: AlertTriangle, dot: 'bg-red-700' },
  ISSUE_RESOLVE: { label: 'समस्या हल', Icon: ShieldCheck, dot: 'bg-green-700' },
};

const title = (e: HistoryEvent) =>
  e.kind === 'ISSUE_OPEN' || e.kind === 'ISSUE_RESOLVE' ? (ISSUE_LABELS[e.titleHi as IssueType]?.hi ?? e.titleHi) : e.titleHi;

/** Vertical timeline of a booth's events, newest first. */
export function Timeline({ events, showUser = false }: { events: HistoryEvent[]; showUser?: boolean }) {
  return (
    <ol className="timeline relative flex flex-col gap-4 pl-2">
      <span className="absolute inset-y-2 left-[1.45rem] w-0.5 bg-line-strong" aria-hidden="true" />
      {events.map((e, i) => {
        const { label, Icon, dot } = KIND[e.kind];
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-3">
            <span className={cn('z-10 grid size-8 shrink-0 place-items-center rounded-full text-white ring-4 ring-canvas', dot)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl bg-surface p-3 shadow-card ring-1 ring-line">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
                <time className="text-xs text-slate-600" dateTime={e.at}>{dayTimeOf(e.at)}</time>
              </div>
              <p className="font-semibold leading-snug">{title(e)}</p>
              {e.detail && <p className="text-sm text-slate-700">{e.detail}</p>}
              {showUser && <p className="text-xs text-slate-600">{e.byUsername}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
