import type { Dashboard, TurnoutCell } from '../../api/types';
import { Card, ProgressBar, SectionTitle } from '../../ui';

const pct = (c: TurnoutCell | undefined) => (c?.percent == null ? '—' : `${c.percent}%`);
const slotName = (s: string) => s.replace('मतदान ', '');

/** Turnout % per PS and slot: a table on wide screens, one card per PS on phones. */
export function TurnoutByPs({ data }: { data: Dashboard }) {
  const slots = data.turnoutSlots;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle title="पंचायत समिति-वार मतदान %" sub="Turnout by PS (over reporting booths)" />
      <Card pad={false} className="table-wrap hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">पंचायत समिति</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">बूथ</th>
              {slots.map((s) => <th key={s.id} scope="col" className="px-3 py-3 text-right font-semibold">{slotName(s.nameHi)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.turnoutByPs.map((p) => (
              <tr key={p.psId} className="hover:bg-saffron-50/50">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">{p.psNameHi}</th>
                <td className="px-3 py-2.5 text-right tabular-nums">{p.booths}</td>
                {p.slots.map((c) => (
                  <td key={c.stepId} className="px-3 py-2.5 text-right tabular-nums">
                    <b>{pct(c)}</b>
                    <div className="text-xs text-slate-600">{c.reported}/{p.booths}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-green-50 font-bold text-green-900">
            <tr>
              <th scope="row" className="px-4 py-3 text-left">ज़िला</th>
              <td className="px-3 py-3 text-right tabular-nums">{data.cards.totalBooths}</td>
              {data.turnoutDistrict.map((c) => <td key={c.stepId} className="px-3 py-3 text-right tabular-nums">{pct(c)}</td>)}
            </tr>
          </tfoot>
        </table>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {data.turnoutByPs.map((p) => {
          const latest = [...p.slots].reverse().find((c) => c.percent !== null);
          return (
            <Card key={p.psId} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <b>{p.psNameHi}</b>
                <span className="text-xl font-extrabold tabular-nums text-saffron-800">{pct(latest)}</span>
              </div>
              <ProgressBar value={latest?.percent ?? 0} max={100} tone="saffron" label={`${p.psNameHi} मतदान`} />
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s, i) => {
                  const c = p.slots[i];
                  return (
                    <div key={s.id} className="rounded-xl bg-canvas px-1 py-2 text-center ring-1 ring-line">
                      <div className="text-xs text-slate-600">{slotName(s.nameHi)}</div>
                      <div className="font-bold tabular-nums">{pct(c)}</div>
                      <div className="text-xs text-slate-600 tabular-nums">{c?.reported ?? 0}/{p.booths}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
