import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import { apiGet } from '../../api/client';
import type { BoothSummary, PsSummary } from '../../api/types';
import { Chips } from '../../components/Chips';
import { ErrorBox, useAutoLoad } from '../../components/ui';
import { usePaged } from '../../components/usePaged';
import { ISSUE_LABELS, PHASE_LABELS, PHASE_ORDER } from '../../labels';
import { Badge, EmptyState, SectionTitle, SkeletonList, StatusDot, cardClass, cn, inputClass } from '../../ui';
import type { Tone } from '../../ui';

type Filter = 'all' | 'pending' | 'issue' | 'behind' | 'nothing';
const FILTERS: readonly (readonly [Filter, string])[] = [
  ['all', 'सभी'],
  ['pending', 'लंबित'],
  ['behind', 'पीछे'],
  ['issue', 'समस्या'],
  ['nothing', 'कुछ नहीं भेजा'],
];

const toneOf = (b: BoothSummary): Tone => (b.openIssue || b.overdue > 0 ? 'red' : b.pending > 0 ? 'slate' : 'green');
const TONE_LABEL: Record<string, string> = { red: 'ध्यान दें', slate: 'लंबित', green: 'ठीक' };

function BoothTile({ b }: { b: BoothSummary }) {
  const tone = toneOf(b);
  return (
    <a href={`#/admin/booth/${b.id}`} className={cn(cardClass(), 'booth-tile flex flex-col gap-2.5 hover:shadow-raised hover:ring-saffron-200')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-bold tabular-nums">
          <StatusDot tone={tone} label={TONE_LABEL[tone] ?? ''} />
          {b.psCode}-{String(b.boothNo).padStart(3, '0')}
        </span>
        {b.openIssue ? <Badge tone="red">{ISSUE_LABELS[b.openIssue.type].hi}</Badge> : b.overdue > 0 && <Badge tone="red">{b.overdue} देर</Badge>}
      </div>
      <div className="line-clamp-2 text-sm text-slate-700">{b.nameHi}</div>
      <div className="flex items-center gap-1.5 text-sm">
        <Users className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
        {b.officer?.fullName ?? <i className="text-slate-600">अधिकारी नहीं</i>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PHASE_ORDER.map((p) => {
          const x = b.phases[p];
          const t: Tone = x.total > 0 && x.done === x.total ? 'green' : x.done > 0 ? 'saffron' : 'slate';
          return <Badge key={p} tone={t}>{PHASE_LABELS[p].hi.replace('मतदान ', '')} {x.done}/{x.total}</Badge>;
        })}
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-2 text-sm">
        <span className="text-slate-600">मतदान</span>
        <span>
          <b className="text-base tabular-nums">{b.latestTurnout?.percent != null ? `${b.latestTurnout.percent}%` : '—'}</b>
          {b.latestTurnout && <span className="text-slate-600"> · {b.latestTurnout.stepNameHi.replace('मतदान ', '')}</span>}
        </span>
      </div>
    </a>
  );
}

/** enforceTimes false: the "पीछे" (behind schedule) filter makes no sense and is hidden. */
export function BoothGrid({ psList, enforceTimes }: { psList: PsSummary[]; enforceTimes: boolean }) {
  const [psId, setPsId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const query = new URLSearchParams({ filter, q: q.trim() });
  if (psId !== null) query.set('ps', String(psId));
  const { data, error } = useAutoLoad(() => apiGet<{ total: number; booths: BoothSummary[] }>(`/api/district/booths?${query.toString()}`), [query.toString()], 30_000);
  const { visible, more } = usePaged(data?.booths ?? null, query.toString());

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="बूथ" sub="Booths and officers" />
      <div className="grid gap-2 sm:grid-cols-2">
        <select className={inputClass()} value={psId ?? ''} onChange={(e) => setPsId(e.target.value === '' ? null : Number(e.target.value))} aria-label="पंचायत समिति">
          <option value="">सभी पंचायत समितियाँ</option>
          {psList.map((p) => <option key={p.id} value={p.id}>{p.nameHi} ({p.code})</option>)}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input className={cn(inputClass(), 'pl-11')} type="search" placeholder="खोजें: बूथ नं., नाम, अधिकारी, मोबाइल" value={q} onChange={(e) => setQ(e.target.value)} aria-label="खोजें" />
        </div>
      </div>
      <Chips options={enforceTimes ? FILTERS : FILTERS.filter(([f]) => f !== 'behind')} value={filter} onChange={setFilter} />
      <ErrorBox error={error} />
      {!data && !error && <SkeletonList rows={3} />}
      {data && <p className="text-sm text-slate-600">{data.total} बूथ{data.total > data.booths.length ? ` · पहले ${data.booths.length} दिखाए (खोज/फ़िल्टर से छोटा करें)` : ''}</p>}
      {data?.total === 0 && <EmptyState icon={Search} title="कोई बूथ नहीं मिला" />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((b) => <BoothTile key={b.id} b={b} />)}</div>
      {more}
    </section>
  );
}
