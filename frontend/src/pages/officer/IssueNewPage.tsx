import { AlertTriangle, Check } from 'lucide-react';
import { useState } from 'react';
import { apiPost } from '../../api/client';
import type { IssueType } from '../../api/types';
import { ErrorBox } from '../../components/ui';
import { OfficerLayout } from '../../layout/OfficerLayout';
import { ISSUE_ICONS } from '../../issueIcons';
import { ISSUE_LABELS, ISSUE_ORDER } from '../../labels';
import { navigate } from '../../router';
import { Button, Card, TextArea, cn, useToast } from '../../ui';

export function IssueNewPage() {
  const toast = useToast();
  const [type, setType] = useState<IssueType | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (type === null) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/officer/issues', { type, note: note.trim() === '' ? null : note.trim() });
      toast('success', 'समस्या दर्ज हुई');
      navigate('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <OfficerLayout title="समस्या दर्ज करें" back="/">
      <p className="text-lg font-bold">
        समस्या का प्रकार चुनें
        <span className="block text-sm font-normal text-slate-600">Choose the type of issue</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="समस्या का प्रकार">
        {ISSUE_ORDER.map((t) => {
          const Icon = ISSUE_ICONS[t];
          const on = type === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setType(t)}
              className={cn(
                'flex min-h-16 items-center gap-3 rounded-card p-4 text-left shadow-card ring-1 transition',
                on ? 'bg-red-700 text-white ring-red-700' : 'bg-surface text-slate-900 ring-line hover:ring-red-300',
              )}
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', on ? 'bg-white/20' : 'bg-red-50 text-red-700')}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex-1 font-bold">
                {ISSUE_LABELS[t].hi}
                <span className={cn('block text-xs font-normal', on ? 'text-white/85' : 'text-slate-600')}>{ISSUE_LABELS[t].en}</span>
              </span>
              {on && <Check className="size-5" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {type !== null && (
        <Card className="flex flex-col gap-4">
          <TextArea label="विवरण (वैकल्पिक)" en="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <ErrorBox error={error} />
          <Button variant="danger" size="lg" block loading={busy} onClick={() => void submit()} icon={<AlertTriangle className="size-5" aria-hidden="true" />}>
            {busy ? 'भेजा जा रहा है…' : 'समस्या दर्ज करें'}
          </Button>
        </Card>
      )}
    </OfficerLayout>
  );
}
