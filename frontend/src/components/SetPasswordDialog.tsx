import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiPost } from '../api/client';
import { PASSWORD_HINT, confirmError, passwordError } from '../rules/credentials';
import { Alert, Button, Dialog, PasswordInput } from '../ui';
import { ErrorBox } from './ui';

/** The admin types a new password for an officer (twice). Ends that officer's sessions. */
export function SetPasswordDialog(props: { open: boolean; userId: number; username: string; onDone: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const close = (done: boolean) => {
    setPassword('');
    setConfirm('');
    setErrors({});
    setError(null);
    if (done) props.onDone();
    else props.onCancel();
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { password: passwordError(password, props.username), confirm: confirmError(password, confirm) };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/admin/officers/${props.userId}/password`, { password, confirmPassword: confirm });
      close(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={props.open} title={`${props.username}: नया पासवर्ड सेट करें`} onClose={() => close(false)}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <Alert tone="info">अधिकारी का पुराना पासवर्ड और चालू लॉगिन बंद हो जाएँगे। नया पासवर्ड उन्हें स्वयं बताएँ।</Alert>
        <PasswordInput label="नया पासवर्ड" en="New password" hint={PASSWORD_HINT} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="new-password" />
        <PasswordInput label="पासवर्ड दोबारा" en="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} autoComplete="new-password" />
        <ErrorBox error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => close(false)}>रद्द करें</Button>
          <Button type="submit" loading={busy}>पासवर्ड सेट करें</Button>
        </div>
      </form>
    </Dialog>
  );
}
