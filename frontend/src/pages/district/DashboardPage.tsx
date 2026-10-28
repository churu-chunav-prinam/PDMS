import { ChevronRight, Download, Lock, PlayCircle, RefreshCw, Siren, TrendingUp, TriangleAlert, Vote } from 'lucide-react';
import { apiGet, apiGetFile } from '../../api/client';
import type { Dashboard, PsSummary } from '../../api/types';
import { ErrorBox, useAutoLoad, useLoad } from '../../components/ui';
import { useServerNow } from '../../components/useClock';
import { AdminLayout } from '../../layout/AdminLayout';
import { PHASE_LABELS, PHASE_ORDER, durationHi, formatNumber, timeOf } from '../../labels';
import { Badge, Button, Card, ProgressBar, SectionTitle, Skeleton, StatTile, cn, useToast } from '../../ui';
import { BoothGrid } from './BoothGrid';
import { TurnoutByPs } from './TurnoutByPs';

export const REFRESH_MS = 30_000;

const EXPORTS = [
  ['reports', 'रिपोर्ट', 'Reports'],
  ['turnout', 'मतदान %', 'Turnout'],
  ['issues', 'समस्याएँ', 'Issues'],
] as const;

export function DashboardPage() {
  const toast = useToast();
  const { data, error } = useAutoLoad(() => apiGet<Dashboard>('/api/district/dashboard'), [], REFRESH_MS);
  const ps = useLoad(() => apiGet<{ panchayatSamitis: PsSummary[] }>('/api/admin/ps').then((r) => r.panchayatSamitis), []);
  const now = useServerNow(data?.serverTime);
  const c = data?.cards;
  const oldest = data?.openIssues[0];

  return (
    <AdminLayout
      title="ज़िला नियंत्रण कक्ष"
      subtitle="District control room · Churu"
      actions={
        data && (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <RefreshCw className="size-4" aria-hidden="true" />
            अंतिम अपडेट {timeOf(data.serverTime)} · हर 30 सेकंड
          </span>
        )
      }
    >
      <ErrorBox error={error} />
      {data && data.openIssues.length > 0 && (
        <a href="#/admin/issues" className="issue-bar flex min-h-16 items-center gap-4 rounded-card bg-red-700 p-4 text-white shadow-raised hover:bg-red-800">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Siren className="size-6 animate-pulse" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">
              {data.openIssues.length} समस्याएँ चल रही हैं
            </span>
            {oldest && <span className="block text-sm text-white/90">सबसे पुरानी {durationHi((now - new Date(oldest.startedAt).getTime()) / 1000)} · tap for list</span>}
          </span>
          <ChevronRight className="size-6 shrink-0" aria-hidden="true" />
        </a>
      )}

      {c ? (
        <div className={cn('grid grid-cols-2 gap-3', data?.enforceStepTimes ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
          <StatTile icon={Vote} value={formatNumber(c.totalBooths)} hi="कुल बूथ" en="Total booths" />
          <StatTile icon={PlayCircle} value={c.pollStarted === null ? '—' : formatNumber(c.pollStarted)} hi="मतदान प्रारंभ" en="Poll started" tone="green" />
          <StatTile icon={TrendingUp} value={c.turnout.percent === null ? '—' : `${c.turnout.percent}%`} hi={`मतदान (${c.turnout.booths} बूथ)`} en="Current turnout" tone="saffron" className={data?.enforceStepTimes ? '' : 'col-span-2 lg:col-span-1'} />
          {data?.enforceStepTimes && (
            <StatTile icon={TriangleAlert} value={formatNumber(c.boothsBehind)} hi="पीछे चल रहे बूथ" en="Booths behind" tone={c.boothsBehind > 0 ? 'red' : 'green'} />
          )}
        </div>
      ) : (
        !error && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
          </div>
        )
      )}
      {data && <p className="text-sm text-slate-600 lg:hidden">अंतिम अपडेट {timeOf(data.serverTime)} · हर 30 सेकंड</p>}

      {data && (
        <section className="flex flex-col gap-3">
          <SectionTitle title="चरण-वार रिपोर्ट" sub="Reported / total — tap to see pending booths" />
          <div className="grid gap-3 xl:grid-cols-3">
            {PHASE_ORDER.map((phase) => {
              const steps = data.perStep.filter((s) => s.phase === phase);
              if (steps.length === 0) return null;
              return (
                <Card key={phase} pad={false} className="overflow-hidden">
                  <h3 className="border-b border-line bg-canvas px-4 py-3 font-bold">{PHASE_LABELS[phase].hi}</h3>
                  <ul className="divide-y divide-line">
                    {steps.map((s) => {
                      const behind = s.overdue && s.reported < s.total;
                      return (
                        <li key={s.id}>
                          <a href={`#/admin/step/${s.id}/pending`} className="step-row flex min-h-14 flex-col gap-2 px-4 py-3 hover:bg-saffron-50/60">
                            <span className="flex items-center justify-between gap-3">
                              <span className={cn('min-w-0 font-semibold leading-snug', behind && 'text-red-700')}>
                                {s.nameHi}
                                {!s.open && <Lock className="ml-1 inline size-3.5 text-slate-500" aria-label="अभी बंद" />}
                              </span>
                              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                                <span>
                                  <b>{formatNumber(s.reported)}</b>
                                  <span className="text-slate-600">/{formatNumber(s.total)}</span>
                                </span>
                                {s.late > 0 && <Badge tone="red">{s.late} देर</Badge>}
                              </span>
                            </span>
                            <ProgressBar value={s.reported} max={s.total} tone={behind ? 'red' : 'green'} label={`${s.nameHi}: ${s.reported}/${s.total}`} />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {data && data.turnoutSlots.length > 0 && <TurnoutByPs data={data} />}

      <Card className="flex flex-col gap-3">
        <SectionTitle title="Excel डाउनलोड" sub="Export" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {EXPORTS.map(([kind, hi, en]) => (
            <Button
              key={kind}
              variant="secondary"
              icon={<Download className="size-5" aria-hidden="true" />}
              onClick={() => void apiGetFile(`/api/district/export/${kind}`, `churu-poll-${kind}.xlsx`).catch(() => toast('error', 'डाउनलोड नहीं हो पाया'))}
            >
              {hi} <span className="font-normal text-slate-600">· {en}</span>
            </Button>
          ))}
        </div>
      </Card>

      {ps.data && data && <BoothGrid psList={ps.data} enforceTimes={data.enforceStepTimes} />}
    </AdminLayout>
  );
}
