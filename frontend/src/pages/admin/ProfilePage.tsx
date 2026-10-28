import { AtSign, KeyRound } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiPost } from '../../api/client';
import { useAuth } from '../../auth';
import { ErrorBox } from '../../components/ui';
import { AdminLayout } from '../../layout/AdminLayout';
import { PASSWORD_HINT, USERNAME_HINT, confirmError, passwordError, usernameError } from '../../rules/credentials';
import { Button, Card, Input, PasswordInput, SectionTitle, useToast } from '../../ui';

/** One form with its own state, error and busy flag (both profile forms share this). */
function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof T) => (e: { target: { value: string } }) => setValues({ ...values, [k]: e.target.value });
  const run = async (check: Partial<Record<keyof T, string | null>>, work: () => Promise<void>) => {
    setErrors(check);
    if (Object.values(check).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      setValues(initial);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return { values, errors, error, busy, set, run };
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const name = useForm({ username: '', currentPassword: '' });
  const pw = useForm({ currentPassword: '', password: '', confirmPassword: '' });
  const me = user?.username ?? '';

  const saveUsername = (e: FormEvent) => {
    e.preventDefault();
    void name.run(
      { username: usernameError(name.values.username), currentPassword: name.values.currentPassword ? null : 'वर्तमान पासवर्ड डालें' },
      async () => {
        await apiPost('/api/profile/username', { username: name.values.username.trim(), currentPassword: name.values.currentPassword });
        await refresh();
        toast('success', 'यूज़रनेम बदला गया');
      },
    );
  };
  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    void pw.run(
      {
        currentPassword: pw.values.currentPassword ? null : 'वर्तमान पासवर्ड डालें',
        password: passwordError(pw.values.password, me),
        confirmPassword: confirmError(pw.values.password, pw.values.confirmPassword),
      },
      async () => {
        await apiPost('/api/profile/password', pw.values);
        toast('success', 'पासवर्ड बदला गया · बाकी डिवाइस से लॉग आउट');
      },
    );
  };

  return (
    <AdminLayout title="मेरा खाता" subtitle={`My account · ${me}`} back="/admin/settings">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <SectionTitle title="यूज़रनेम बदलें" sub={`अभी: ${me}`} />
          <form className="flex flex-col gap-4" onSubmit={saveUsername} noValidate>
            <Input label="नया यूज़रनेम" en="New username" hint={USERNAME_HINT} value={name.values.username} onChange={name.set('username')} error={name.errors.username} autoCapitalize="none" autoComplete="username" />
            <PasswordInput label="वर्तमान पासवर्ड" en="Current password" value={name.values.currentPassword} onChange={name.set('currentPassword')} error={name.errors.currentPassword} autoComplete="current-password" />
            <ErrorBox error={name.error} />
            <Button type="submit" loading={name.busy} icon={<AtSign className="size-5" aria-hidden="true" />}>यूज़रनेम सहेजें</Button>
          </form>
        </Card>
        <Card className="flex flex-col gap-4">
          <SectionTitle title="पासवर्ड बदलें" sub="बाकी सभी डिवाइस पर लॉग आउट हो जाएगा" />
          <form className="flex flex-col gap-4" onSubmit={savePassword} noValidate>
            <PasswordInput label="वर्तमान पासवर्ड" en="Current password" value={pw.values.currentPassword} onChange={pw.set('currentPassword')} error={pw.errors.currentPassword} autoComplete="current-password" />
            <PasswordInput label="नया पासवर्ड" en="New password" hint={PASSWORD_HINT} value={pw.values.password} onChange={pw.set('password')} error={pw.errors.password} autoComplete="new-password" />
            <PasswordInput label="पासवर्ड दोबारा" en="Confirm password" value={pw.values.confirmPassword} onChange={pw.set('confirmPassword')} error={pw.errors.confirmPassword} autoComplete="new-password" />
            <ErrorBox error={pw.error} />
            <Button type="submit" loading={pw.busy} icon={<KeyRound className="size-5" aria-hidden="true" />}>पासवर्ड सहेजें</Button>
          </form>
        </Card>
      </div>
    </AdminLayout>
  );
}
