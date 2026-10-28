import { CalendarClock, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiGet, apiPost } from '../../api/client';
import type { Phase, StepMaster, StepType } from '../../api/types';
import { ErrorBox, useLoad } from '../../components/ui';
import { AdminLayout } from '../../layout/AdminLayout';
import { PHASE_LABELS, PHASE_ORDER, dayTimeOf, toLocalInput } from '../../labels';
import { Alert, Badge, Button, Card, Input, SectionTitle, Select, SkeletonList, cn, useConfirm, useToast } from '../../ui';

const TYPES: [StepType, string][] = [
  ['DONE', 'पूर्ण (हाँ)'],
  ['NUMBER', 'संख्या'],
  ['TURNOUT', 'मतदान (पु/म/तृ)'],
];

interface Draft {
  phase: Phase;
  sortOrder: string;
  nameHi: string;
  nameEn: string;
  type: StepType;
  numberLabelHi: string;
  numberLabelEn: string;
  opensAt: string;
  dueBy: string;
}

const toDraft = (s: StepMaster | null, phase: Phase = 'POLL_DAY'): Draft => ({
  phase: s?.phase ?? phase,
  sortOrder: String(s?.sortOrder ?? ''),
  nameHi: s?.nameHi ?? '',
  nameEn: s?.nameEn ?? '',
  type: s?.type ?? 'DONE',
  numberLabelHi: s?.numberLabelHi ?? '',
  numberLabelEn: s?.numberLabelEn ?? '',
  opensAt: toLocalInput(s?.opensAt ?? null),
  dueBy: toLocalInput(s?.dueBy ?? null),
});

const orNull = (v: string) => (v.trim() === '' ? null : v.trim());

function StepForm({ step, onDone }: { step: StepMaster | null; onDone: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => toDraft(step));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const locked = (step?.reports ?? 0) > 0; // phase and type stay fixed once reports exist
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = {
      phase: d.phase, sortOrder: Number(d.sortOrder), nameHi: d.nameHi.trim(), nameEn: d.nameEn.trim(), type: d.type,
      numberLabelHi: orNull(d.numberLabelHi), numberLabelEn: orNull(d.numberLabelEn),
      opensAt: orNull(d.opensAt), dueBy: orNull(d.dueBy),
    };
    try {
      await apiPost(step ? `/api/district/steps/${step.id}/update` : '/api/district/steps', body);
      toast('success', 'चरण सहेजा गया');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submit(e)}>
      <Select label="चरण-समूह" en="Phase" value={d.phase} disabled={locked} onChange={set('phase')}>
        {PHASE_ORDER.map((p) => <option key={p} value={p}>{PHASE_LABELS[p].hi}</option>)}
      </Select>
      <Input label="क्रम" en="Order" inputMode="numeric" value={d.sortOrder} onChange={set('sortOrder')} required />
      <Input label="नाम (हिंदी)" en="Name (Hindi)" value={d.nameHi} onChange={set('nameHi')} required />
      <Input label="Name (English)" value={d.nameEn} onChange={set('nameEn')} required />
      <Select label="प्रकार" en="Type" value={d.type} disabled={locked} onChange={set('type')}>
        {TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
      </Select>
      {d.type === 'NUMBER' ? (
        <>
          <Input label="संख्या का लेबल (हिंदी)" en="Number label (Hindi)" value={d.numberLabelHi} onChange={set('numberLabelHi')} required />
          <Input label="Number label (English)" value={d.numberLabelEn} onChange={set('numberLabelEn')} />
        </>
      ) : (
        <span className="hidden sm:block" />
      )}
      <Input label="खुलने का समय" en="Opens at (empty = always open)" type="datetime-local" value={d.opensAt} onChange={set('opensAt')} />
      <Input label="समय सीमा" en="Due by (empty = no deadline)" type="datetime-local" value={d.dueBy} onChange={set('dueBy')} />
      {locked && <Alert tone="warning" className="sm:col-span-2">इस चरण में {step?.reports} रिपोर्ट हैं: समूह और प्रकार नहीं बदले जा सकते।</Alert>}
      <div className="sm:col-span-2"><ErrorBox error={error} /></div>
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>रद्द करें</Button>
        <Button type="submit" loading={busy}>सहेजें</Button>
      </div>
    </form>
  );
}

export function StepMasterPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => apiGet<{ steps: StepMaster[] }>('/api/district/steps').then((r) => r.steps), []);
  const settings = useLoad(() => apiGet<{ enforceStepTimes: boolean }>('/api/district/settings'), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const act = (path: string, body: object | undefined, done: string) => {
    setActionError(null);
    apiPost(path, body).then(() => {
      toast('success', done);
      reload();
    }, setActionError);
  };
  const close = () => {
    setEditing(null);
    reload();
  };

  return (
    <AdminLayout
      title="चरण सूची"
      subtitle="Step master"
      actions={editing !== 'new' && <Button icon={<Plus className="size-5" aria-hidden="true" />} onClick={() => setEditing('new')}>नया चरण जोड़ें</Button>}
    >
      <ErrorBox error={error ?? actionError} />
      {settings.data && !settings.data.enforceStepTimes && (
        <Alert tone="info">
          समय सीमा अभी बंद है: नीचे के खुलने/सीमा समय लागू नहीं हैं (सेटिंग में चालू करें)।
          <span className="block text-xs font-normal">Step times are off: the times below are saved but not applied.</span>
        </Alert>
      )}
      {editing === 'new' && (
        <Card tone="saffron" className="flex flex-col gap-4">
          <SectionTitle title="नया चरण" sub="New step" />
          <StepForm step={null} onDone={close} />
        </Card>
      )}
      {!data && !error && <SkeletonList rows={6} />}
      {PHASE_ORDER.map((phase) => {
        const steps = data?.filter((s) => s.phase === phase) ?? [];
        if (!data) return null;
        return (
          <section key={phase} className="flex flex-col gap-3">
            <SectionTitle title={PHASE_LABELS[phase].hi} sub={`${steps.length} चरण`} />
            <div className="grid gap-3 lg:grid-cols-2">
              {steps.map((s) => (
                <Card key={s.id} className={cn('flex flex-col gap-3', !s.active && editing !== s.id && 'opacity-75', editing === s.id && 'lg:col-span-2')}>
                  {editing === s.id ? (
                    <StepForm step={s} onDone={close} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold leading-snug">
                          <span className="mr-1.5 text-slate-500 tabular-nums">{s.sortOrder}.</span>
                          {s.nameHi}
                          <span className="block text-sm font-normal text-slate-600">{s.nameEn}</span>
                        </p>
                        <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? 'सक्रिय' : 'निष्क्रिय'}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge tone="saffron">{TYPES.find(([t]) => t === s.type)?.[1]}{s.numberLabelHi && ` · ${s.numberLabelHi}`}</Badge>
                        <Badge tone="slate">रिपोर्ट {s.reports}</Badge>
                      </div>
                      <p className="flex items-start gap-1.5 text-sm text-slate-700">
                        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {s.opensAt ? `खुलेगा ${dayTimeOf(s.opensAt)}` : 'हमेशा खुला'} · {s.dueBy ? `सीमा ${dayTimeOf(s.dueBy)}` : 'कोई सीमा नहीं'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditing(s.id)}>बदलें</Button>
                        <Button size="sm" variant="secondary" icon={<Power className="size-4" aria-hidden="true" />} onClick={() => act(`/api/district/steps/${s.id}/active`, { active: !s.active }, s.active ? 'चरण निष्क्रिय किया' : 'चरण सक्रिय किया')}>
                          {s.active ? 'निष्क्रिय करें' : 'सक्रिय करें'}
                        </Button>
                        {s.reports === 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-700 hover:bg-red-50"
                            icon={<Trash2 className="size-4" aria-hidden="true" />}
                            onClick={() =>
                              void confirm({ title: `"${s.nameHi}" हटाएँ?`, confirmLabel: 'हटाएँ', variant: 'danger' }).then((ok) => {
                                if (ok) act(`/api/district/steps/${s.id}/delete`, undefined, 'चरण हटाया गया');
                              })
                            }
                          >
                            हटाएँ
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </AdminLayout>
  );
}
