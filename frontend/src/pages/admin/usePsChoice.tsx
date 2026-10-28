import { useEffect, useState } from 'react';
import type { PsSummary } from '../../api/types';
import { Select } from '../../ui';

const KEY = 'poll.admin.ps';

/** The chosen Panchayat Samiti, remembered per browser tab (convenience only). */
export function usePsChoice(list: PsSummary[] | null): [number | null, (id: number) => void] {
  const [psId, setPsId] = useState<number | null>(() => {
    try {
      const v = Number(sessionStorage.getItem(KEY));
      return Number.isInteger(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (list && list.length > 0 && !list.some((p) => p.id === psId)) setPsId(list[0]?.id ?? null);
  }, [list, psId]);
  const choose = (id: number) => {
    setPsId(id);
    try {
      sessionStorage.setItem(KEY, String(id));
    } catch {
      /* storage blocked: fine */
    }
  };
  return [psId, choose];
}

export function PsSelect({ list, value, onChange }: { list: PsSummary[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <Select label="पंचायत समिति" en="Panchayat Samiti" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))}>
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nameHi} ({p.code}) · {p.activeOfficers}/{p.booths}
        </option>
      ))}
    </Select>
  );
}
