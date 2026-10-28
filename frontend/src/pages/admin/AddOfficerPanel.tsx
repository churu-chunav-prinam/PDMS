import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { apiPost } from '../../api/client';
import type { CreatedOfficer } from '../../api/types';
import { BoothPicker, NO_BOOTH } from '../../components/BoothPicker';
import type { BoothChoice } from '../../components/BoothPicker';
import { OfficerForm } from '../../components/OfficerForm';
import { Button, Card, SectionTitle, useToast } from '../../ui';

/** Add one officer: PS -> ward -> booth (same picker as the officer login), then all details. */
export function AddOfficerPanel({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<BoothChoice>(NO_BOOTH);
  const close = () => {
    setOpen(false);
    setChoice(NO_BOOTH);
  };
  if (!open) {
    return (
      <Button icon={<UserPlus className="size-5" aria-hidden="true" />} onClick={() => setOpen(true)}>
        नया अधिकारी जोड़ें
      </Button>
    );
  }
  const boothId = choice.boothId;
  return (
    <Card tone="saffron" className="flex flex-col gap-4">
      <SectionTitle title="नया अधिकारी जोड़ें" sub="Add officer: all fields required" />
      <div className="grid gap-4 sm:grid-cols-3">
        <BoothPicker value={choice} onChange={setChoice} />
      </div>
      {boothId === null ? (
        <Button variant="secondary" onClick={close}>रद्द करें</Button>
      ) : (
        <OfficerForm
          key={boothId}
          mode="create"
          submitLabel="खाता बनाएँ"
          onCancel={close}
          onSubmit={async (f) => {
            const r = await apiPost<{ officer: CreatedOfficer }>('/api/admin/officers', { boothId, ...f });
            close();
            toast('success', `खाता बना: ${r.officer.username}`);
            onCreated();
          }}
        />
      )}
    </Card>
  );
}
