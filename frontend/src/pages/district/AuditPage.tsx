import { ChevronDown, ScrollText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet } from '../../api/client';
import type { AuditEntry } from '../../api/types';
import { ErrorBox } from '../../components/ui';
import { AdminLayout } from '../../layout/AdminLayout';
import { dayTimeOf } from '../../labels';
import { Badge, Button, Card, EmptyState, SkeletonList } from '../../ui';
import type { Tone } from '../../ui';

const short = (v: unknown) => (v === null || v === undefined ? '' : JSON.stringify(v).slice(0, 300));
const toneOf = (action: string): Tone =>
  /FAILED|LOCKED|DISABLE|DELETE/.test(action) ? 'red' : /EDIT|UPDATE|PASSWORD|USERNAME|POLL_DATE/.test(action) ? 'amber' : /LOGIN|LOGOUT|SESSION/.test(action) ? 'slate' : 'green';

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const more = (before: number | null) => {
    apiGet<{ entries: AuditEntry[] }>(`/api/district/audit${before === null ? '' : `?before=${before}`}`).then((r) => {
      setEntries((e) => [...(e ?? []), ...r.entries]);
      if (r.entries.length < 100) setDone(true);
    }, setError);
  };
  useEffect(() => more(null), []);

  return (
    <AdminLayout title="ऑडिट लॉग" subtitle="Audit log (append-only)" back="/admin/settings">
      <ErrorBox error={error} />
      {entries === null && !error && <SkeletonList rows={6} />}
      {entries?.length === 0 && <EmptyState icon={ScrollText} title="कोई प्रविष्टि नहीं" />}
      <Card pad={false} className="divide-y divide-line overflow-hidden">
        {entries?.map((e) => (
          <div key={e.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={toneOf(e.action)} className="font-mono">{e.action}</Badge>
              <time className="text-xs text-slate-600" dateTime={e.at}>{dayTimeOf(e.at)}</time>
            </div>
            <p className="text-sm">
              <b>{e.username ?? 'system'}</b> · {e.entity}
              {e.entityId !== null && ` #${e.entityId}`}
            </p>
            {e.reason && <p className="text-sm">कारण: {e.reason}</p>}
            {e.newValue !== null && (
              <p className="font-mono text-xs text-slate-600 [overflow-wrap:anywhere]">
                {short(e.oldValue) && `${short(e.oldValue)} → `}
                {short(e.newValue)}
              </p>
            )}
          </div>
        ))}
      </Card>
      {!done && entries && entries.length > 0 && (
        <Button variant="secondary" block icon={<ChevronDown className="size-5" aria-hidden="true" />} onClick={() => more(entries[entries.length - 1]?.id ?? null)}>
          और देखें
        </Button>
      )}
    </AdminLayout>
  );
}
