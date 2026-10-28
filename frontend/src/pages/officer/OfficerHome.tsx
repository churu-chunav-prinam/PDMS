import { AlertTriangle, ChevronRight, ClipboardCheck, History, ListTodo, MapPin, Siren, Truck, Vote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { OfficerHomeData, Phase } from '../../api/types';
import { ErrorBox, useLoad } from '../../components/ui';
import { useServerNow } from '../../components/useClock';
import { OfficerLayout } from '../../layout/OfficerLayout';
import { PHASE_LABELS, durationHi, formatNumber } from '../../labels';
import { Badge, Card, LinkButton, ProgressRing, Skeleton, buttonClass, cn } from '../../ui';

const PHASE_ICON: Record<Phase, LucideIcon> = { PRE_POLL: Truck, POLL_DAY: Vote, POST_POLL: ClipboardCheck };

export function OfficerHome() {
  const { data, error } = useLoad(() => apiGet<OfficerHomeData>('/api/officer/home'), []);
  const now = useServerNow(data?.serverTime);
  if (!data) {
    return (
      <OfficerLayout title="मेरा बूथ">
        <ErrorBox error={error} />
        {!error && (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-28" />
            <Skeleton className="h-20" />
          </>
        )}
      </OfficerLayout>
    );
  }
  const { booth, progress, phases, openIssue } = data;
  const code = `${booth.psCode}-${String(booth.boothNo).padStart(3, '0')}`;
  return (
    <OfficerLayout title={code} subtitle={booth.nameHi}>
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-saffron-50 text-2xl font-extrabold text-saffron-800 ring-1 ring-saffron-200">{booth.boothNo}</span>
          <div className="min-w-0">
            <p className="font-bold leading-snug [overflow-wrap:anywhere]">{booth.nameHi}</p>
            <p className="flex items-center gap-1 text-sm text-slate-600">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              पंचायत समिति {booth.psNameHi}
            </p>
          </div>
        </div>
        <dl className="facts grid grid-cols-3 gap-2 text-center">
          {[
            ['PS वार्ड', String(booth.psWardNo)],
            ['ZP वार्ड', String(booth.zpWardNo)],
            ['कुल मतदाता', formatNumber(booth.registeredVoters)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-canvas px-1 py-2.5 ring-1 ring-line">
              <dt className="text-xs text-slate-600">{label}</dt>
              <dd className="text-xl font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex items-center gap-5">
        <ProgressRing value={progress.done} max={progress.total}>
          <span>
            <span className="block text-2xl font-extrabold tabular-nums">{progress.done}</span>
            <span className="block text-xs text-slate-600">/ {progress.total}</span>
          </span>
        </ProgressRing>
        <div>
          <p className="text-xl font-bold">
            {progress.total} में से {progress.done} पूरे
          </p>
          <p className="text-sm text-slate-600">{progress.done === progress.total && progress.total > 0 ? 'सभी चरण पूरे ✓' : 'अगला चरण चुनें'}</p>
        </div>
      </Card>

      <nav className="flex flex-col gap-3" aria-label="चरण">
        {phases.map((p) => {
          const Icon = PHASE_ICON[p.phase];
          const done = p.total > 0 && p.done === p.total;
          return (
            <a
              key={p.phase}
              href={`#/phase/${p.phase}`}
              className={cn('flex min-h-20 items-center gap-4 rounded-card p-4 shadow-card ring-1 transition hover:shadow-raised', done ? 'bg-green-50 ring-green-200' : 'bg-surface ring-line')}
            >
              <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', done ? 'bg-green-700 text-white' : 'bg-saffron-50 text-saffron-700')}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="phase-label min-w-0 flex-1">
                <span className="block text-lg font-bold">{PHASE_LABELS[p.phase].hi}</span>
                <span className="block text-sm text-slate-600">{PHASE_LABELS[p.phase].en}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-xl font-extrabold tabular-nums">
                  {p.done}/{p.total}
                </span>
                {p.overdue > 0 && <Badge tone="red">{p.overdue} देर</Badge>}
              </span>
              <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
            </a>
          );
        })}
      </nav>

      {openIssue ? (
        <a href="#/issues" className={cn(buttonClass('danger', 'lg', true), 'min-h-16 flex-col !gap-0 py-2')}>
          <span className="flex items-center gap-2">
            <Siren className="size-5 animate-pulse" aria-hidden="true" />
            समस्या चल रही है · {durationHi((now - new Date(openIssue.startedAt).getTime()) / 1000)}
          </span>
          <span className="text-sm font-normal opacity-90">Issue open – tap to resolve</span>
        </a>
      ) : (
        <LinkButton href="#/issue/new" variant="danger" size="lg" block className="min-h-16" icon={<AlertTriangle className="size-6" aria-hidden="true" />}>
          समस्या दर्ज करें
        </LinkButton>
      )}
      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="#/issues" variant="secondary" icon={<ListTodo className="size-5" aria-hidden="true" />}>मेरी समस्याएँ</LinkButton>
        <LinkButton href="#/history" variant="secondary" icon={<History className="size-5" aria-hidden="true" />}>मेरा इतिहास</LinkButton>
      </div>
    </OfficerLayout>
  );
}
