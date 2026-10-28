import { CheckCircle2, Phone } from 'lucide-react';
import { apiGet } from '../../api/client';
import type { Dashboard } from '../../api/types';
import { ErrorBox, useAutoLoad, useLoad } from '../../components/ui';
import { usePaged } from '../../components/usePaged';
import { AdminLayout } from '../../layout/AdminLayout';
import { Card, EmptyState, SkeletonList, StatusDot } from '../../ui';
import { REFRESH_MS } from './DashboardPage';

interface PendingBooth {
  boothId: number;
  boothNo: number;
  nameHi: string;
  psCode: string;
  officerName: string | null;
  officerMobile: string | null;
}

export function PendingPage({ stepId }: { stepId: number }) {
  const { data, error } = useAutoLoad(() => apiGet<{ booths: PendingBooth[] }>(`/api/district/steps/${stepId}/pending`).then((r) => r.booths), [stepId], REFRESH_MS);
  const dash = useLoad(() => apiGet<Dashboard>('/api/district/dashboard'), []);
  const step = dash.data?.perStep.find((s) => s.id === stepId);
  const { visible, more } = usePaged(data, String(stepId));
  return (
    <AdminLayout title={step ? `लंबित: ${step.nameHi}` : 'लंबित बूथ'} subtitle="Booths that have not reported this step" back="/">
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={4} />}
      {data && (
        <p className="text-lg">
          <b className="tabular-nums">{data.length}</b> बूथों ने अभी नहीं भेजा
        </p>
      )}
      {data?.length === 0 && <EmptyState icon={CheckCircle2} title="सभी बूथों ने भेज दिया ✓" />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((b) => (
          <Card key={b.boothId} className="flex flex-col gap-1.5">
            <a href={`#/admin/booth/${b.boothId}`} className="flex min-h-11 items-center gap-2 font-bold tabular-nums text-saffron-800 hover:underline">
              <StatusDot tone="slate" label="लंबित" />
              {b.psCode}-{String(b.boothNo).padStart(3, '0')}
            </a>
            <div className="line-clamp-2 text-sm text-slate-700">{b.nameHi}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {b.officerName ?? <i className="text-slate-600">अधिकारी नहीं</i>}
              {b.officerMobile && (
                <a href={`tel:${b.officerMobile}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-green-800 ring-1 ring-green-200 hover:bg-green-50">
                  <Phone className="size-4" aria-hidden="true" />
                  {b.officerMobile}
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
      {more}
    </AdminLayout>
  );
}
