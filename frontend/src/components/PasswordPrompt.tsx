import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Dialog, Input } from '../ui';
import { ErrorBox } from './ui';

/** Asks the admin's own password before a sensitive action (in a modal dialog). */
export function PasswordPrompt(props: { open: boolean; title: string; onConfirm: (password: string) => Promise<void>; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await props.onConfirm(password);
      setPassword('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={props.open} title={props.title} onClose={props.onCancel}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <Input label="अपना पासवर्ड दोबारा डालें" en="Re-enter your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorBox error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={props.onCancel}>रद्द करें</Button>
          <Button type="submit" loading={busy}>पुष्टि करें</Button>
        </div>
      </form>
    </Dialog>
  );
}
