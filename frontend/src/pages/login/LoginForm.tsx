import { LogIn } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ErrorBox } from '../../components/ui';
import { TopBar } from '../../layout/TopBar';
import { Button, Card, PasswordInput } from '../../ui';

/** Shared shell of both login pages: title, the page's own fields, password, error, submit. */
export function LoginForm(props: {
  titleHi: string;
  titleEn: string;
  icon: ReactNode;
  children: ReactNode;
  canSubmit: boolean;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await props.onSubmit(password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar narrow title={props.titleHi} back="/" />
      <main className="safe-bottom mx-auto flex max-w-md flex-col px-4 pt-6 sm:pt-12">
        <Card className="flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-saffron-50 text-saffron-700">{props.icon}</span>
            <h1 className="text-xl font-bold leading-tight">
              {props.titleHi}
              <span className="block text-sm font-normal text-slate-600">{props.titleEn}</span>
            </h1>
          </div>
          <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
            {props.children}
            <PasswordInput label="पासवर्ड" en="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <ErrorBox error={error} />
            <Button type="submit" size="lg" block loading={busy} disabled={!props.canSubmit || password === ''} icon={<LogIn className="size-5" aria-hidden="true" />}>
              {busy ? 'कृपया प्रतीक्षा करें…' : 'लॉगिन करें'}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-slate-600">
          पासवर्ड भूल गए? ज़िला नियंत्रण कक्ष से नया पासवर्ड लें।
          <span className="block text-xs">Forgot the password? Ask the district control room.</span>
        </p>
      </main>
    </div>
  );
}
