import { FileDown, FileSpreadsheet, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiDownload, apiGet } from '../../api/client';
import type { BoothOfficer, PsSummary } from '../../api/types';
import { Chips } from '../../components/Chips';
import { PasswordPrompt } from '../../components/PasswordPrompt';
import { ErrorBox, useLoad } from '../../components/ui';
import { AdminLayout } from '../../layout/AdminLayout';
import { Button, Card, EmptyState, LinkButton, ProgressBar, SkeletonList, cn, inputClass } from '../../ui';
import { AddOfficerPanel } from './AddOfficerPanel';
import { BoothOfficerCard } from './BoothOfficerCard';
import { PsSelect, usePsChoice } from './usePsChoice';

type Filter = 'all' | 'none' | 'active' | 'disabled';
const FILTERS: readonly (readonly [Filter, string])[] = [['all', 'सभी'], ['none', 'अधिकारी नहीं'], ['active', 'सक्रिय'], ['disabled', 'बंद']];

export function OfficersPage() {
  const ps = useLoad(() => apiGet<{ panchayatSamitis: PsSummary[] }>('/api/admin/ps').then((r) => r.panchayatSamitis), []);
  const [psId, setPsId] = usePsChoice(ps.data);
  const booths = useLoad(
    () => (psId === null ? Promise.resolve([]) : apiGet<{ booths: BoothOfficer[] }>(`/api/admin/booths?ps=${psId}`).then((r) => r.booths)),
    [psId],
  );
  const [askPassword, setAskPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const current = ps.data?.find((p) => p.id === psId) ?? null;

  const refresh = () => {
    ps.reload();
    booths.reload();
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (booths.data ?? []).filter((b) => {
      const o = b.officer;
      if (filter === 'none' && o) return false;
      if (filter === 'active' && !o?.active) return false;
      if (filter === 'disabled' && (!o || o.active)) return false;
      if (q === '') return true;
      return [String(b.boothNo), b.boothName, o?.fullName ?? '', o?.username ?? '', o?.mobile ?? ''].some((s) => s.toLowerCase().includes(q));
    });
  }, [booths.data, search, filter]);

  return (
    <AdminLayout title="अधिकारी खाते" subtitle="Officer accounts" back="/">
      <ErrorBox error={ps.error ?? booths.error} />
      <AddOfficerPanel onCreated={refresh} />
      {ps.data && (
        <Card className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <PsSelect list={ps.data} value={psId} onChange={setPsId} />
            {current && (
              <div>
                <p className="text-lg">
                  <b className="tabular-nums">{current.booths}</b> में से <b className="tabular-nums">{current.activeOfficers}</b> बूथों पर अधिकारी
                </p>
                <ProgressBar className="mt-2" value={current.activeOfficers} max={current.booths} label="अधिकारी वाले बूथ" />
              </div>
            )}
          </div>
          {current && (
            <div className="flex flex-col gap-2">
              <LinkButton href="#/admin/bulk" variant="secondary" icon={<FileSpreadsheet className="size-5" aria-hidden="true" />}>
                Excel से अधिकारी जोड़ें
              </LinkButton>
              <Button variant="secondary" icon={<FileDown className="size-5" aria-hidden="true" />} onClick={() => setAskPassword(true)}>
                अधिकारी सूची Excel (यूज़रनेम सहित)
              </Button>
            </div>
          )}
        </Card>
      )}
      {current && (
        <PasswordPrompt
          open={askPassword}
          title={`${current.nameHi}: अधिकारी सूची Excel`}
          onCancel={() => setAskPassword(false)}
          onConfirm={async (password) => {
            await apiDownload('/api/admin/credentials', { psId: current.id, password }, `credentials-${current.code}.xlsx`);
            setAskPassword(false);
          }}
        />
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input className={cn(inputClass(), 'pl-11')} type="search" placeholder="खोजें: बूथ नं., नाम, मोबाइल" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="खोजें" />
      </div>
      <Chips options={FILTERS} value={filter} onChange={setFilter} />
      {booths.data === null && !booths.error && <SkeletonList rows={3} />}
      {booths.data && shown.length === 0 && <EmptyState icon={Users} title="कोई बूथ नहीं मिला" />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((b) => <BoothOfficerCard key={b.boothId} booth={b} onChanged={refresh} />)}
      </div>
    </AdminLayout>
  );
}
