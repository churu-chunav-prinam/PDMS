import { CalendarDays, ChevronRight, Clock, FileSpreadsheet, ScrollText, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api/client';
import { ErrorBox, useLoad } from '../../components/ui';
import { AdminLayout } from '../../layout/AdminLayout';
import { Alert, Button, Card, Input, SectionTitle, Switch, cardClass, cn, useConfirm, useToast } from '../../ui';

export function SettingsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => apiGet<{ pollDate: string; enforceStepTimes: boolean }>('/api/district/settings'), []);
  const [date, setDate] = useState('');
  const [saveError, setSaveError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setDate(data.pollDate);
  }, [data]);

  const save = async () => {
    if (!(await confirm({ title: `मतदान तिथि ${date} करें?`, message: 'सभी चरणों के समय उतने ही दिन खिसक जाएँगे।', confirmLabel: 'सहेजें' }))) return;
    setSaveError(null);
    setBusy(true);
    try {
      const r = await apiPost<{ pollDate: string; shiftedDays: number }>('/api/district/settings/poll-date', { pollDate: date });
      setMessage(`सहेजा गया: ${r.pollDate} · चरण ${r.shiftedDays} दिन खिसके`);
      toast('success', 'मतदान तिथि सहेजी गई');
      reload();
    } catch (err) {
      setSaveError(err);
    } finally {
      setBusy(false);
    }
  };

  const setEnforce = async (enabled: boolean) => {
    const ok = await confirm({
      title: enabled ? 'समय सीमा लागू करें?' : 'समय सीमा बंद करें?',
      message: enabled
        ? 'चरण अपने समय से पहले नहीं खुलेंगे, देर से भेजी रिपोर्ट "देर से" दिखेगी और डैशबोर्ड पर पीछे चल रहे बूथ गिने जाएँगे।'
        : 'हर सक्रिय चरण कभी भी दर्ज हो सकेगा; कोई ताला, देर या "पीछे" नहीं दिखेगा।',
      confirmLabel: enabled ? 'लागू करें' : 'बंद करें',
    });
    if (!ok) return;
    setSaveError(null);
    try {
      await apiPost('/api/district/settings/enforce-step-times', { enabled });
      toast('success', enabled ? 'समय सीमा लागू' : 'समय सीमा बंद');
      reload();
    } catch (err) {
      setSaveError(err);
    }
  };

  return (
    <AdminLayout title="सेटिंग" subtitle="Settings">
      <ErrorBox error={error ?? saveError} />
      {data && (
        <Card className="flex max-w-xl items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-saffron-50 text-saffron-700">
            <Clock className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              समय सीमा लागू करें
              <span className="block text-sm font-normal text-slate-600">Enforce step times</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {data.enforceStepTimes
                ? 'चालू: चरण अपने समय पर खुलते हैं; देर और पीछे चल रहे बूथ दिखते हैं।'
                : 'बंद: हर सक्रिय चरण कभी भी दर्ज हो सकता है।'}
            </p>
          </div>
          <Switch checked={data.enforceStepTimes} onChange={(v) => void setEnforce(v)} label="समय सीमा लागू करें" />
        </Card>
      )}
      <Card className="flex max-w-xl flex-col gap-4">
        <SectionTitle title="मतदान तिथि" sub="Poll date: all step times move with it" />
        <Input label="मतदान तिथि" en="Poll date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {message && <Alert tone="success">{message}</Alert>}
        <Button size="lg" loading={busy} disabled={!date || date === data?.pollDate} onClick={() => void save()} icon={<CalendarDays className="size-5" aria-hidden="true" />}>
          सहेजें
        </Button>
      </Card>
      <div className="grid max-w-xl gap-3">
        {[
          { href: '#/admin/profile', Icon: UserCog, hi: 'मेरा खाता', en: 'My account: username and password' },
          { href: '#/admin/audit', Icon: ScrollText, hi: 'ऑडिट लॉग', en: 'Audit log' },
          { href: '#/admin/bulk', Icon: FileSpreadsheet, hi: 'Excel से अधिकारी जोड़ें', en: 'Bulk add from Excel' },
        ].map(({ href, Icon, hi, en }) => (
          <a key={href} href={href} className={cn(cardClass(), 'flex min-h-16 items-center gap-3 hover:shadow-raised')}>
            <span className="grid size-11 place-items-center rounded-xl bg-saffron-50 text-saffron-700"><Icon className="size-5" aria-hidden="true" /></span>
            <span className="flex-1 font-bold">{hi}<span className="block text-sm font-normal text-slate-600">{en}</span></span>
            <ChevronRight className="size-5 text-slate-400" aria-hidden="true" />
          </a>
        ))}
      </div>
    </AdminLayout>
  );
}
