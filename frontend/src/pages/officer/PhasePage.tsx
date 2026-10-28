import { AlertCircle, CheckCircle2, ChevronRight, Circle, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { BoothStep, Phase, StepsData } from '../../api/types';
import { ErrorBox, useLoad } from '../../components/ui';
import { OfficerLayout } from '../../layout/OfficerLayout';
import { PHASE_LABELS, formatNumber, timeOf } from '../../labels';
import { Badge, EmptyState, SkeletonList, cn } from '../../ui';

const STATUS: Record<BoothStep['status'], { Icon: LucideIcon; row: string; icon: string }> = {
  done: { Icon: CheckCircle2, row: 'bg-green-50 ring-green-200', icon: 'text-green-700' },
  pending: { Icon: Circle, row: 'bg-surface ring-line', icon: 'text-slate-400' },
  locked: { Icon: Lock, row: 'bg-slate-50 ring-slate-200 text-slate-600', icon: 'text-slate-500' },
  overdue: { Icon: AlertCircle, row: 'bg-surface ring-2 ring-red-600', icon: 'text-red-700' },
};

export function StepStatusIcon({ status }: { status: BoothStep['status'] }) {
  const { Icon, icon } = STATUS[status];
  return <Icon className={cn('size-7 shrink-0', icon)} aria-hidden="true" />;
}

/** One line under a step's name: done time and values, lock time, overdue, or the deadline. */
export function StepSummary({ step }: { step: BoothStep }) {
  const r = step.report;
  if (r) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
        <span className="font-semibold text-green-800">✓ {timeOf(r.reportedAt)}</span>
        {r.late && <Badge tone="red">देर से</Badge>}
        {r.edited && <Badge tone="amber">संशोधित</Badge>}
        {r.value !== null && <span>{step.numberLabelHi}: <b>{formatNumber(r.value)}</b></span>}
        {r.turnout && <span>कुल <b>{formatNumber(r.turnout.total)}</b>{r.turnout.percent !== null && ` · ${r.turnout.percent}%`}</span>}
      </div>
    );
  }
  if (step.status === 'locked' && step.opensAt) return <div className="text-sm">{timeOf(step.opensAt)} से खुलेगा</div>;
  if (step.status === 'overdue' && step.dueBy) return <div className="text-sm font-semibold text-red-700">समय निकल गया ({timeOf(step.dueBy)} तक)</div>;
  return <div className="text-sm text-slate-600">{step.dueBy ? `${timeOf(step.dueBy)} तक` : 'लंबित'}</div>;
}

export function PhasePage({ phase }: { phase: Phase }) {
  const { data, error } = useLoad(() => apiGet<StepsData>(`/api/officer/steps?phase=${phase}`), [phase]);
  return (
    <OfficerLayout title={PHASE_LABELS[phase].hi} subtitle={PHASE_LABELS[phase].en} back="/">
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={5} />}
      <ol className="flex flex-col gap-3">
        {data?.steps.map((s) => {
          const locked = s.status === 'locked';
          return (
            <li key={s.id}>
              <a
                className={cn('step-card flex min-h-20 items-center gap-3 rounded-card p-4 shadow-card ring-1', STATUS[s.status].row, locked ? 'cursor-not-allowed' : 'hover:shadow-raised')}
                href={locked ? undefined : `#/step/${phase}/${s.id}`}
                aria-disabled={locked || undefined}
              >
                <StepStatusIcon status={s.status} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="font-bold leading-snug">
                    {s.nameHi}
                    <span className="block text-xs font-normal text-slate-600">{s.nameEn}</span>
                  </div>
                  <StepSummary step={s} />
                </div>
                {!locked && <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />}
              </a>
            </li>
          );
        })}
      </ol>
      {data?.steps.length === 0 && <EmptyState icon={CheckCircle2} title="इस चरण में कोई कार्य नहीं" />}
    </OfficerLayout>
  );
}
