import { MapPin } from 'lucide-react';
import { apiGet } from '../api/client';
import type { PickerBooth, PickerWard, PsSummary } from '../api/types';
import { Alert, Select, cn } from '../ui';
import { ErrorBox, useLoad } from './ui';

export interface BoothChoice {
  psId: number | null;
  wardId: number | null;
  boothId: number | null;
}
export const NO_BOOTH: BoothChoice = { psId: null, wardId: null, boothId: null };

const none = <T,>(): Promise<T[]> => Promise.resolve([]);
const toId = (v: string) => (v === '' ? null : Number(v));

function StepNo({ n, done }: { n: number; done: boolean }) {
  return (
    <span aria-hidden="true" className={cn('grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold', done ? 'bg-green-700 text-white' : 'bg-saffron-100 text-saffron-800')}>
      {n}
    </span>
  );
}

/**
 * पंचायत समिति -> वार्ड -> बूथ for the admin's "add officer" form. Each list loads only after the
 * previous choice; changing a level clears the levels below it. Admin-only API lists.
 */
export function BoothPicker({ value, onChange }: { value: BoothChoice; onChange: (next: BoothChoice) => void }) {
  const ps = useLoad(() => apiGet<{ panchayatSamitis: PsSummary[] }>('/api/admin/ps').then((r) => r.panchayatSamitis), []);
  const wards = useLoad(
    () => (value.psId === null ? none<PickerWard>() : apiGet<{ wards: PickerWard[] }>(`/api/admin/ps/${value.psId}/wards`).then((r) => r.wards)),
    [value.psId],
  );
  const booths = useLoad(
    () => (value.wardId === null ? none<PickerBooth>() : apiGet<{ booths: PickerBooth[] }>(`/api/admin/wards/${value.wardId}/booths`).then((r) => r.booths)),
    [value.wardId],
  );
  // Long booth names are cut off inside a closed <select>: show the chosen one in full.
  const chosen = booths.data?.find((b) => b.id === value.boothId);

  return (
    <>
      <Select label="पंचायत समिति" en="Panchayat Samiti" marker={<StepNo n={1} done={value.psId !== null} />} value={value.psId ?? ''} onChange={(e) => onChange({ ...NO_BOOTH, psId: toId(e.target.value) })}>
        <option value="">— चुनें —</option>
        {ps.data?.map((p) => <option key={p.id} value={p.id}>{p.nameHi} ({p.code})</option>)}
      </Select>
      <Select
        label="वार्ड"
        en="PS ward"
        marker={<StepNo n={2} done={value.wardId !== null} />}
        value={value.wardId ?? ''}
        disabled={value.psId === null || wards.data === null}
        onChange={(e) => onChange({ ...value, wardId: toId(e.target.value), boothId: null })}
      >
        <option value="">{value.psId === null ? 'पहले पंचायत समिति चुनें' : '— चुनें —'}</option>
        {wards.data?.map((w) => <option key={w.id} value={w.id}>वार्ड {w.wardNo}</option>)}
      </Select>
      <Select
        label="बूथ"
        en="Booth"
        marker={<StepNo n={3} done={value.boothId !== null} />}
        value={value.boothId ?? ''}
        disabled={value.wardId === null || booths.data === null}
        onChange={(e) => onChange({ ...value, boothId: toId(e.target.value) })}
      >
        <option value="">{value.wardId === null ? 'पहले वार्ड चुनें' : '— चुनें —'}</option>
        {booths.data?.map((b) => <option key={b.id} value={b.id}>{b.boothNo} · {b.nameHi}</option>)}
      </Select>
      {/* col-span-full: spans the row when the picker sits in a grid (admin form); no effect in a column. */}
      {chosen && (
        <Alert tone="info" className="col-span-full">
          <span className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            बूथ {chosen.boothNo}: {chosen.nameHi}
          </span>
        </Alert>
      )}
      <div className="col-span-full empty:hidden">
        <ErrorBox error={ps.error ?? wards.error ?? booths.error} />
      </div>
    </>
  );
}
