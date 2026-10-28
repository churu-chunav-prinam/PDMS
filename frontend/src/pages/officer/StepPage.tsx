import { CheckCircle2, Lock, Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiGet, apiPost } from '../../api/client';
import type { BoothStep, Phase, StepsData, Turnout } from '../../api/types';
import { ErrorBox, useLoad } from '../../components/ui';
import { OfficerLayout } from '../../layout/OfficerLayout';
import { TURNOUT_FIELDS, formatNumber, timeOf } from '../../labels';
import { navigate } from '../../router';
import { Alert, Button, Card, Input, ProgressBar, SkeletonList, TextArea, useToast } from '../../ui';
import { StepStatusIcon, StepSummary } from './PhasePage';

type Draft = Record<'value' | keyof Turnout, string>;

const toDraft = (s: BoothStep): Draft => ({
  value: s.report?.value?.toString() ?? '',
  male: s.report?.turnout?.male.toString() ?? '',
  female: s.report?.turnout?.female.toString() ?? '',
  third: s.report?.turnout?.third.toString() ?? '',
});
const num = (v: string) => (v === '' ? null : Number(v));

function StepForm({ step, registeredVoters }: { step: BoothStep; registeredVoters: number }) {
  const toast = useToast();
  const editing = step.report !== null;
  const [open, setOpen] = useState(!editing);
  const [draft, setDraft] = useState<Draft>(() => toDraft(step));
  const [reason, setReason] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const total = TURNOUT_FIELDS.reduce((sum, [f]) => sum + (num(draft[f]) ?? 0), 0);
  const prev = step.previousTurnout;
  const percent = registeredVoters > 0 ? Math.round((total / registeredVoters) * 1000) / 10 : null;

  const body = (): object | null => {
    if (step.type === 'DONE') return {};
    if (step.type === 'NUMBER') {
      const v = num(draft.value);
      return v === null ? null : { value: v };
    }
    const [male, female, third] = TURNOUT_FIELDS.map(([f]) => num(draft[f]));
    if (male === null || male === undefined || female === null || female === undefined || third === null || third === undefined) return null;
    return { turnout: { male, female, third } };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const b = body();
    if (b === null) return setHint(step.type === 'TURNOUT' ? 'तीनों संख्या भरें (0 भी चलेगा)' : 'संख्या भरें');
    if (step.type === 'TURNOUT' && total > registeredVoters) return setHint(`कुल ${total} पंजीकृत मतदाताओं (${registeredVoters}) से अधिक है`);
    if (editing && reason.trim().length < 3) return setHint('संशोधन का कारण लिखें');
    setHint(null);
    setBusy(true);
    setError(null);
    try {
      if (editing) await apiPost(`/api/officer/steps/${step.id}/edit`, { ...b, reason: reason.trim() });
      else await apiPost(`/api/officer/steps/${step.id}/report`, b);
      toast('success', editing ? 'संशोधन सहेजा गया' : `${step.nameHi}: दर्ज हुआ`);
      navigate(`/phase/${step.phase}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" size="lg" block icon={<Pencil className="size-5" aria-hidden="true" />} onClick={() => setOpen(true)}>
        संशोधन करें
      </Button>
    );
  }
  const set = (f: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [f]: e.target.value.replace(/\D/g, '').slice(0, 6) });

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      {step.type === 'NUMBER' && <Input label={step.numberLabelHi ?? 'संख्या'} big inputMode="numeric" value={draft.value} onChange={set('value')} />}
      {step.type === 'TURNOUT' && (
        <>
          <Alert tone="info">
            <div className="flex items-center gap-1.5">
              <Users className="size-4" aria-hidden="true" />
              पंजीकृत मतदाता: <b>{formatNumber(registeredVoters)}</b>
            </div>
            {prev && (
              <div className="mt-1">
                पिछला ({prev.stepNameHi}): पु {prev.male} · म {prev.female} · तृ {prev.third} = <b>{prev.total}</b>
              </div>
            )}
            <div className="mt-1 text-xs font-normal">Cumulative: total votes so far, not since last slot.</div>
          </Alert>
          <div className="grid gap-3 sm:grid-cols-3">
            {TURNOUT_FIELDS.map(([f, hi, en]) => (
              <Input key={f} label={hi} en={en} big inputMode="numeric" value={draft[f]} onChange={set(f)} />
            ))}
          </div>
          <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-200" aria-live="polite">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-green-900">कुल</span>
              <span className="text-3xl font-extrabold tabular-nums text-green-900">
                {formatNumber(total)}
                {percent !== null && <span className="ml-2 text-lg font-bold">{percent}%</span>}
              </span>
            </div>
            <ProgressBar className="mt-2" value={Math.min(total, registeredVoters)} max={registeredVoters} tone={total > registeredVoters ? 'red' : 'green'} label="मतदान प्रतिशत" />
          </div>
        </>
      )}
      {editing && <TextArea label="संशोधन का कारण" en="Reason for correction" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />}
      {hint !== null && <Alert tone="error">{hint}</Alert>}
      <ErrorBox error={error} />
      <Button type="submit" variant="success" size="lg" block loading={busy} className="min-h-16 text-xl" icon={<CheckCircle2 className="size-6" aria-hidden="true" />}>
        {busy ? 'सहेजा जा रहा है…' : editing ? 'संशोधन सहेजें' : step.type === 'DONE' ? 'पूर्ण हुआ ✓' : 'दर्ज करें ✓'}
      </Button>
    </form>
  );
}

export function StepPage({ phase, stepId }: { phase: Phase; stepId: number }) {
  const { data, error } = useLoad(() => apiGet<StepsData>(`/api/officer/steps?phase=${phase}`), [phase]);
  const step = data?.steps.find((s) => s.id === stepId);
  return (
    <OfficerLayout title={step?.nameHi ?? ''} back={`/phase/${phase}`}>
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={3} />}
      {data && !step && <Alert tone="warning">चरण नहीं मिला</Alert>}
      {step && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <StepStatusIcon status={step.status} />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-xl font-bold leading-snug">
                {step.nameHi}
                <span className="block text-sm font-normal text-slate-600">{step.nameEn}</span>
              </h1>
              <StepSummary step={step} />
            </div>
          </div>
          {step.status === 'locked' && step.opensAt ? (
            <Alert tone="warning">
              <span className="flex items-center gap-1.5">
                <Lock className="size-4" aria-hidden="true" />
                यह चरण {timeOf(step.opensAt)} से खुलेगा
              </span>
            </Alert>
          ) : (
            <StepForm key={step.id} step={step} registeredVoters={data?.registeredVoters ?? 0} />
          )}
        </Card>
      )}
    </OfficerLayout>
  );
}
