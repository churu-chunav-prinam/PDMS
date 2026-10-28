import { KeyRound, Pencil, Phone, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { apiPost } from '../../api/client';
import type { BoothOfficer, CreatedOfficer } from '../../api/types';
import { OfficerForm } from '../../components/OfficerForm';
import { SetPasswordDialog } from '../../components/SetPasswordDialog';
import { ErrorBox } from '../../components/ui';
import { formatNumber } from '../../labels';
import { Badge, Button, Card, StatusDot, useConfirm, useToast } from '../../ui';
import type { Tone } from '../../ui';

type Mode = 'view' | 'add' | 'edit';

export function BoothOfficerCard(props: { booth: BoothOfficer; onChanged: () => void }) {
  const { booth } = props;
  const o = booth.officer;
  const confirm = useConfirm();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('view');
  const [settingPassword, setSettingPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const tone: Tone = !o ? 'slate' : !o.active ? 'red' : 'green';
  const status = !o ? 'अधिकारी नहीं' : !o.active ? 'बंद' : o.locked ? 'लॉक' : 'सक्रिय';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-saffron-50 text-lg font-extrabold tabular-nums text-saffron-800 ring-1 ring-saffron-200">{booth.boothNo}</span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug">{booth.boothName}</p>
          <p className="text-sm text-slate-600">
            PS वार्ड {booth.psWardNo} · ZP वार्ड {booth.zpWardNo} · मतदाता {formatNumber(booth.voters)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-canvas px-3 py-2 text-sm ring-1 ring-line">
        <StatusDot tone={tone} label={status} />
        <Badge tone={tone}>{status}</Badge>
        {o && <span className="font-mono font-semibold">{o.username}</span>}
        {o && <span>{o.fullName ?? <i className="text-slate-600">नाम नहीं</i>}</span>}
        {o?.mobile && (
          <a href={`tel:${o.mobile}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-green-800 hover:underline">
            <Phone className="size-4" aria-hidden="true" />
            {o.mobile}
          </a>
        )}
      </div>

      <ErrorBox error={error} />

      {mode === 'add' && (
        <OfficerForm
          mode="create"
          submitLabel="खाता बनाएँ"
          onCancel={() => setMode('view')}
          onSubmit={async (f) => {
            const r = await apiPost<{ officer: CreatedOfficer }>('/api/admin/officers', { boothId: booth.boothId, ...f });
            setMode('view');
            toast('success', `खाता बना: ${r.officer.username}`);
            props.onChanged();
          }}
        />
      )}
      {mode === 'edit' && o && (
        <OfficerForm
          mode="edit"
          initial={{ fullName: o.fullName ?? '', mobile: o.mobile ?? '', username: o.username }}
          submitLabel="सहेजें"
          onCancel={() => setMode('view')}
          onSubmit={async (f) => {
            await apiPost(`/api/admin/officers/${o.id}/update`, f);
            setMode('view');
            toast('success', f.username !== o.username ? 'सहेजा गया · अधिकारी को दोबारा लॉगिन करना होगा' : 'सहेजा गया');
            props.onChanged();
          }}
        />
      )}
      {/* Mounted only while open: one dialog in the page, not one per booth. */}
      {o && settingPassword && (
        <SetPasswordDialog
          open
          userId={o.id}
          username={o.username}
          onCancel={() => setSettingPassword(false)}
          onDone={() => {
            setSettingPassword(false);
            toast('success', `${o.username}: नया पासवर्ड सेट हुआ`);
          }}
        />
      )}

      {mode === 'view' && (
        <div className="flex flex-wrap gap-2">
          {(!o || !o.active) && (
            <Button size="sm" icon={<UserPlus className="size-4" aria-hidden="true" />} onClick={() => setMode('add')}>अधिकारी जोड़ें</Button>
          )}
          {o?.active && (
            <>
              <Button size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setMode('edit')}>बदलें</Button>
              <Button size="sm" variant="secondary" icon={<KeyRound className="size-4" aria-hidden="true" />} onClick={() => setSettingPassword(true)}>नया पासवर्ड सेट करें</Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-700 hover:bg-red-50"
                icon={<UserX className="size-4" aria-hidden="true" />}
                onClick={() => {
                  setError(null);
                  void confirm({ title: `${o.username}: खाता बंद करें?`, confirmLabel: 'बंद करें', variant: 'danger' }).then(async (ok) => {
                    if (!ok) return;
                    try {
                      await apiPost(`/api/admin/officers/${o.id}/disable`);
                      toast('success', 'खाता बंद किया');
                      props.onChanged();
                    } catch (err) {
                      setError(err);
                    }
                  });
                }}
              >
                बंद करें
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
