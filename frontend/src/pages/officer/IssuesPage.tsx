import { CheckCircle2, Clock, Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { apiGet, apiPost } from '../../api/client';
import type { Issue } from '../../api/types';
import { ErrorBox, useLoad } from '../../components/ui';
import { useServerNow } from '../../components/useClock';
import { ISSUE_ICONS } from '../../issueIcons';
import { OfficerLayout } from '../../layout/OfficerLayout';
import { ISSUE_LABELS, dayTimeOf, durationHi } from '../../labels';
import { Badge, Button, Card, EmptyState, LinkButton, SkeletonList, TextArea, useToast } from '../../ui';

function ResolveForm({ issue, onDone }: { issue: Issue; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button variant="success" size="lg" block icon={<CheckCircle2 className="size-5" aria-hidden="true" />} onClick={() => setOpen(true)}>
        हल हुई
      </Button>
    );
  }
  const submit = async () => {
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      await apiPost(`/api/officer/issues/${issue.id}/resolve`, { resolution: text.trim() });
      toast('success', 'समस्या हल दर्ज हुई');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <TextArea label="समस्या कैसे हल हुई?" en="How was it resolved?" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
      <ErrorBox error={error} />
      <Button variant="success" block loading={busy} disabled={text.trim().length < 3} onClick={() => void submit()}>
        सहेजें
      </Button>
    </div>
  );
}

export function IssuesPage() {
  const { data, error, reload } = useLoad(() => apiGet<{ issues: Issue[] }>('/api/officer/issues').then((r) => r.issues), []);
  const now = useServerNow(undefined);
  return (
    <OfficerLayout title="मेरे द्वारा दर्ज समस्याएँ" back="/">
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={2} />}
      {data?.length === 0 && <EmptyState icon={ShieldCheck} title="कोई समस्या दर्ज नहीं" />}
      {data?.map((i) => {
        const open = i.resolvedAt === null;
        const seconds = i.durationSeconds ?? (now - new Date(i.startedAt).getTime()) / 1000;
        const Icon = ISSUE_ICONS[i.type];
        return (
          <Card key={i.id} tone={open ? 'red' : 'neutral'} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className={open ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-red-700 text-white' : 'grid size-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700'}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{ISSUE_LABELS[i.type].hi}</b>
                  <Badge tone={open ? 'red' : 'green'}>{open ? 'चल रही है' : 'हल'}</Badge>
                </div>
                {i.note && <p className="mt-1 text-slate-800">{i.note}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-600">
                  <Clock className="size-4" aria-hidden="true" />
                  {dayTimeOf(i.startedAt)} से · {durationHi(seconds)}
                  {i.resolvedAt && ` · ${dayTimeOf(i.resolvedAt)} हल`}
                </p>
                {i.resolution && <p className="mt-1 text-sm text-slate-800">समाधान: {i.resolution}</p>}
              </div>
            </div>
            {open && <ResolveForm issue={i} onDone={reload} />}
          </Card>
        );
      })}
      <LinkButton href="#/issue/new" variant="secondary" block icon={<Plus className="size-5" aria-hidden="true" />}>
        नई समस्या दर्ज करें
      </LinkButton>
    </OfficerLayout>
  );
}
