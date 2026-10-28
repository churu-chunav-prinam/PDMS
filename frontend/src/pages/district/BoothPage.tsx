import { Clock, History, Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { BoothDetail } from '../../api/types';
import { Timeline } from '../../components/Timeline';
import { ErrorBox, useAutoLoad } from '../../components/ui';
import { ISSUE_ICONS } from '../../issueIcons';
import { AdminLayout } from '../../layout/AdminLayout';
import { ISSUE_LABELS, PHASE_LABELS, PHASE_ORDER, dayTimeOf, durationHi, formatNumber, timeOf, valuesLine } from '../../labels';
import { Badge, Card, EmptyState, LinkButton, ProgressBar, SectionTitle, SkeletonList, cn } from '../../ui';
import { StepStatusIcon, StepSummary } from '../officer/PhasePage';
import { REFRESH_MS } from './DashboardPage';

export function BoothPage({ boothId }: { boothId: number }) {
  const { data, error } = useAutoLoad(() => apiGet<BoothDetail>(`/api/district/booths/${boothId}`), [boothId], REFRESH_MS);
  const b = data?.booth;
  const turnout = data?.steps.filter((s) => s.type === 'TURNOUT') ?? [];
  const code = b ? `${b.psCode}-${String(b.boothNo).padStart(3, '0')}` : 'बूथ';
  return (
    <AdminLayout title={code} {...(b ? { subtitle: b.nameHi } : {})} back="/">
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={4} />}
      {data && b && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="flex flex-col gap-4">
              <div>
                <p className="font-bold leading-snug [overflow-wrap:anywhere]">{b.nameHi}</p>
                <p className="text-sm text-slate-600">
                  पंचायत समिति {b.psNameHi} · PS वार्ड {b.psWardNo} · ZP वार्ड {b.zpWardNo} · मतदाता {formatNumber(b.registeredVoters)}
                </p>
              </div>
              {data.officer ? (
                <div className="flex flex-col gap-3 rounded-xl bg-canvas p-3 ring-1 ring-line sm:flex-row sm:items-center">
                  <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-saffron-100 text-saffron-800 sm:grid">
                    <UserRound className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {data.officer.fullName ?? '—'}
                      <Badge tone={data.officer.active ? 'green' : 'red'}>{data.officer.active ? 'सक्रिय' : 'बंद'}</Badge>
                    </p>
                    <p className="text-sm text-slate-600">
                      <span className="font-mono">{data.officer.username}</span> · अंतिम लॉगिन: {data.officer.lastLoginAt ? dayTimeOf(data.officer.lastLoginAt) : 'कभी नहीं'}
                    </p>
                  </div>
                  {data.officer.mobile && (
                    <LinkButton href={`tel:${data.officer.mobile}`} variant="success" className="w-full sm:w-auto" icon={<Phone className="size-5" aria-hidden="true" />}>
                      {data.officer.mobile}
                    </LinkButton>
                  )}
                </div>
              ) : (
                <Badge tone="slate">अधिकारी नहीं</Badge>
              )}
            </Card>

            {turnout.length > 0 && (
              <Card className="flex flex-col gap-3">
                <SectionTitle title="मतदान" sub="Turnout per slot" />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {turnout.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1 rounded-xl bg-canvas p-2 text-center ring-1 ring-line">
                      <span className="text-xs text-slate-600">{s.nameHi.replace('मतदान ', '')}</span>
                      <b className="tabular-nums">{s.report?.turnout?.percent != null ? `${s.report.turnout.percent}%` : '—'}</b>
                      <span className="text-xs tabular-nums text-slate-700">{s.report?.turnout ? formatNumber(s.report.turnout.total) : ' '}</span>
                      <ProgressBar value={s.report?.turnout?.percent ?? 0} max={100} tone="saffron" label={s.nameHi} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {PHASE_ORDER.map((phase) => (
              <Card key={phase} pad={false} className="overflow-hidden">
                <h3 className="border-b border-line bg-canvas px-4 py-3 font-bold">{PHASE_LABELS[phase].hi}</h3>
                <ul className="divide-y divide-line">
                  {data.steps.filter((s) => s.phase === phase).map((s) => (
                    <li key={s.id} className={cn('flex items-start gap-3 px-4 py-3', s.status === 'overdue' && 'bg-red-50/60')}>
                      <StepStatusIcon status={s.status} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{s.nameHi}</p>
                        <StepSummary step={s} />
                        {s.report?.turnout && (
                          <p className="text-sm tabular-nums text-slate-700">पु {s.report.turnout.male} · म {s.report.turnout.female} · तृ {s.report.turnout.third}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <SectionTitle title="समस्याएँ" sub="Issue history" />
              {data.issues.length === 0 && <EmptyState icon={ShieldCheck} title="कोई नहीं" />}
              {data.issues.map((i) => {
                const Icon = ISSUE_ICONS[i.type];
                return (
                  <div key={i.id} className={cn('flex gap-3 rounded-xl p-3 ring-1', i.resolvedAt ? 'bg-canvas ring-line' : 'bg-red-50 ring-red-200')}>
                    <Icon className={cn('mt-0.5 size-5 shrink-0', i.resolvedAt ? 'text-green-700' : 'text-red-700')} aria-hidden="true" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {ISSUE_LABELS[i.type].hi}
                        {i.resolvedAt ? <Badge tone="green">हल</Badge> : <Badge tone="red">चल रही है</Badge>}
                      </p>
                      {i.note && <p>{i.note}</p>}
                      <p className="flex items-center gap-1 text-slate-600">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {timeOf(i.startedAt)} {i.resolvedAt && `– ${timeOf(i.resolvedAt)}`} {i.durationSeconds !== null && `· ${durationHi(i.durationSeconds)}`}
                      </p>
                      {i.resolution && <p>समाधान: {i.resolution}</p>}
                    </div>
                  </div>
                );
              })}
            </Card>

            <Card className="flex flex-col gap-3">
              <SectionTitle title="संशोधन इतिहास" sub="Edit history" />
              {data.edits.length === 0 && <EmptyState icon={Pencil} title="कोई संशोधन नहीं" />}
              {data.edits.map((e, i) => (
                <div key={`${e.at}-${i}`} className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
                  <p className="font-bold">{e.stepNameHi}</p>
                  <p className="tabular-nums">
                    <span className="text-slate-600 line-through">{valuesLine(e.oldValue)}</span> → <b>{valuesLine(e.newValue)}</b>
                  </p>
                  <p>कारण: {e.reason}</p>
                  <p className="text-slate-600">{dayTimeOf(e.at)} · {e.byUsername}</p>
                </div>
              ))}
            </Card>

            <Card className="flex flex-col gap-3">
              <SectionTitle title="समयरेखा" sub="Timeline" />
              {data.history.length === 0 ? <EmptyState icon={History} title="अभी कुछ दर्ज नहीं" /> : <Timeline events={data.history} showUser />}
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
