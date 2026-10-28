import { CheckCircle2, Download, FileUp, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ApiError, apiGetFile, apiPost, fileToBase64 } from '../../api/client';
import type { BulkRow } from '../../api/types';
import { ErrorBox } from '../../components/ui';
import { AdminLayout } from '../../layout/AdminLayout';
import { Alert, Badge, Button, Card, Field, SectionTitle, cn } from '../../ui';

import { PASSWORD_REASONS } from '../../rules/credentials';

const PROBLEMS: Record<string, string> = {
  BOOTH_INVALID: 'बूथ गलत लिखा (जैसे RTG-045)',
  PS_CODE_UNKNOWN: 'PS कोड गलत',
  BOOTH_NOT_FOUND: 'यह बूथ नहीं मिला',
  DUPLICATE_IN_FILE: 'फ़ाइल में यह बूथ दो बार',
  BOOTH_HAS_OFFICER: 'बूथ पर पहले से अधिकारी',
  NAME_INVALID: 'नाम गलत (केवल अक्षर)',
  MOBILE_INVALID: 'मोबाइल गलत (10 अंक, 6-9 से शुरू)',
  USERNAME_INVALID: 'यूज़रनेम गलत (3-30: a-z 0-9 . - _)',
  USERNAME_TAKEN: 'यूज़रनेम पहले से किसी और का है',
  DUPLICATE_USERNAME_IN_FILE: 'फ़ाइल में यह यूज़रनेम दो बार',
  PASSWORD_REQUIRED: 'पासवर्ड खाली है',
  ...PASSWORD_REASONS,
};

interface BulkResponse {
  committed: boolean;
  rows: BulkRow[];
  problemRows: number;
  created?: number;
}

export function BulkPage() {
  const [file, setFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const send = async (commit: boolean) => {
    if (file === null) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await apiPost<BulkResponse>('/api/admin/officers/bulk', { file, commit }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BULK_HAS_PROBLEMS') setResult(err.body as unknown as BulkResponse);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (result?.committed) {
    return (
      <AdminLayout title="Excel से अधिकारी" subtitle="Bulk add" back="/admin/officers">
        <Card tone="green" className="flex max-w-2xl flex-col gap-4" role="status">
          <p className="flex items-center gap-2 text-lg font-bold text-green-900">
            <CheckCircle2 className="size-6" aria-hidden="true" />
            {result.created ?? result.rows.length} खाते बने
          </p>
          <p className="text-sm text-slate-700">अधिकारी Excel में दिए यूज़रनेम और पासवर्ड से लॉगिन करेंगे। Excel फ़ाइल को सुरक्षित रखें या हटा दें।</p>
          <Button variant="success" onClick={() => (window.location.hash = '/admin/officers')}>हो गया</Button>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Excel से अधिकारी" subtitle="Bulk add from Excel" back="/admin/officers">
      <Card className="flex max-w-2xl flex-col gap-4">
        <SectionTitle title="1. फ़ाइल चुनें और जाँचें" sub="One row per booth. First check (dry run), then create." />
        <Alert tone="info">
          कॉलम (सभी ज़रूरी): <b className="font-mono">booth, name, mobile, username, password</b>
          <span className="mt-1 block text-xs font-normal">booth = PS कोड-बूथ नंबर, जैसे RTG-045 · पासवर्ड: कम से कम 8 अक्षर, एक अक्षर और एक अंक</span>
        </Alert>
        <Button variant="secondary" icon={<Download className="size-5" aria-hidden="true" />} onClick={() => void apiGetFile('/api/admin/officers/template.xlsx', 'officers-template.xlsx').catch(setError)}>
          खाली टेम्पलेट डाउनलोड
        </Button>
        <Field label="भरी हुई Excel फ़ाइल चुनें" en="Choose filled .xlsx">
          {(id) => (
            <label htmlFor={id} className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-canvas p-4 text-center hover:border-saffron-600">
              <FileUp className="size-7 text-saffron-700" aria-hidden="true" />
              <span className="font-semibold">{fileName ?? 'फ़ाइल चुनें (.xlsx)'}</span>
              <input
                id={id}
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setResult(null);
                  setFile(null);
                  setFileName(f?.name ?? null);
                  if (f) void fileToBase64(f).then(setFile, setError);
                }}
              />
            </label>
          )}
        </Field>
        <Button size="lg" loading={busy && !result} disabled={file === null || busy} onClick={() => void send(false)} icon={<ShieldCheck className="size-5" aria-hidden="true" />}>
          1. जाँचें
        </Button>
      </Card>
      <ErrorBox error={error} />
      {result && (
        <>
          <Card tone={result.problemRows === 0 ? 'green' : 'red'} className="flex max-w-2xl flex-col gap-3">
            <p className="text-lg font-bold">
              {result.rows.length} पंक्तियाँ · {result.problemRows === 0 ? 'सब सही ✓' : `${result.problemRows} में त्रुटि`}
            </p>
            <Button variant="success" size="lg" loading={busy} disabled={result.problemRows > 0 || busy} onClick={() => void send(true)} icon={<CheckCircle2 className="size-5" aria-hidden="true" />}>
              2. {result.rows.length} खाते बनाएँ
            </Button>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.rows.map((r) => (
              <Card key={r.rowNumber} className={cn('flex flex-col gap-1.5', r.problems.length > 0 && 'ring-2 ring-red-300')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-600">पंक्ति {r.rowNumber}</span>
                  {r.problems.length === 0 ? <Badge tone="green">सही</Badge> : <Badge tone="red">त्रुटि</Badge>}
                </div>
                <p className="font-mono font-semibold">{r.booth ?? '—'} · {r.username ?? '—'}</p>
                <p>{r.officerName ?? '—'}</p>
                {r.boothName !== null && <p className="line-clamp-2 text-sm text-slate-600">{r.boothName}</p>}
                {r.problems.map((p) => (
                  <p key={p} className="flex items-center gap-1 text-sm font-semibold text-red-700">
                    <XCircle className="size-4" aria-hidden="true" />
                    {PROBLEMS[p] ?? p}
                  </p>
                ))}
              </Card>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
