import { ChevronRight, Phone, ShieldCheck } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { OpenIssueRow } from '../../api/types';
import { ErrorBox, useAutoLoad } from '../../components/ui';
import { useServerNow } from '../../components/useClock';
import { ISSUE_ICONS } from '../../issueIcons';
import { AdminLayout } from '../../layout/AdminLayout';
import { ISSUE_LABELS, durationHi, timeOf } from '../../labels';
import { Badge, EmptyState, SkeletonList, cardClass, cn } from '../../ui';
import { REFRESH_MS } from './DashboardPage';

export function IssuesListPage() {
  const { data, error } = useAutoLoad(() => apiGet<{ openIssues: OpenIssueRow[] }>('/api/district/issues').then((r) => r.openIssues), [], REFRESH_MS);
  const now = useServerNow(undefined);
  return (
    <AdminLayout title="चल रही समस्याएँ" subtitle="Open issues, oldest first" back="/">
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={3} />}
      {data?.length === 0 && <EmptyState icon={ShieldCheck} title="कोई समस्या नहीं चल रही ✓" />}
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.map((i) => {
          const Icon = ISSUE_ICONS[i.type];
          return (
            <a key={i.id} href={`#/admin/booth/${i.boothId}`} className={cn(cardClass('red'), 'link-card flex items-start gap-3 hover:shadow-raised')}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-700 text-white">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <b>{ISSUE_LABELS[i.type].hi}</b>
                  <Badge tone="red">{durationHi((now - new Date(i.startedAt).getTime()) / 1000)}</Badge>
                </span>
                <span className="mt-1 block font-semibold tabular-nums">
                  {i.psCode}-{String(i.boothNo).padStart(3, '0')} <span className="font-normal text-slate-700">· {i.boothNameHi}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-700">
                  {timeOf(i.startedAt)} से
                  {i.officerMobile && (
                    <>
                      <Phone className="ml-2 size-4" aria-hidden="true" />
                      {i.officerMobile}
                    </>
                  )}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 self-center text-red-700" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </AdminLayout>
  );
}
