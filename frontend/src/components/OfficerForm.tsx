import { useState } from 'react';
import type { FormEvent } from 'react';
import { MOBILE_HINT, PASSWORD_HINT, USERNAME_HINT, confirmError, mobileError, passwordError, usernameError } from '../rules/credentials';
import { Button, Input, PasswordInput } from '../ui';
import { ErrorBox } from './ui';

export interface OfficerDetails {
  fullName: string;
  mobile: string;
  username: string;
}
export interface NewOfficer extends OfficerDetails {
  password: string;
  confirmPassword: string;
}

type Errors = Partial<Record<keyof NewOfficer, string | null>>;

/**
 * create: name, mobile, username, password, confirm (all required).
 * edit:   name, mobile, username (the password has its own "नया पासवर्ड सेट करें").
 */
export function OfficerForm(
  props:
    | { mode: 'create'; submitLabel: string; onSubmit: (v: NewOfficer) => Promise<void>; onCancel: () => void }
    | { mode: 'edit'; initial: OfficerDetails; submitLabel: string; onSubmit: (v: OfficerDetails) => Promise<void>; onCancel: () => void },
) {
  const init = props.mode === 'edit' ? props.initial : { fullName: '', mobile: '', username: '' };
  const [v, setV] = useState<NewOfficer>({ ...init, password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof NewOfficer, clean: (s: string) => string = (s) => s) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: clean(e.target.value) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      fullName: v.fullName.trim().length < 2 ? 'अधिकारी का नाम भरें' : null,
      mobile: mobileError(v.mobile),
      username: usernameError(v.username),
      ...(props.mode === 'create'
        ? { password: passwordError(v.password, v.username), confirmPassword: confirmError(v.password, v.confirmPassword) }
        : {}),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      const details = { fullName: v.fullName.trim(), mobile: v.mobile, username: v.username.trim() };
      if (props.mode === 'create') await props.onSubmit({ ...details, password: v.password, confirmPassword: v.confirmPassword });
      else await props.onSubmit(details);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submit(e)} noValidate>
      <Input label="अधिकारी का नाम" en="Officer name" value={v.fullName} onChange={set('fullName')} maxLength={120} error={errors.fullName} required autoComplete="off" />
      <Input
        label="मोबाइल नंबर"
        en="Mobile"
        hint={MOBILE_HINT}
        inputMode="numeric"
        value={v.mobile}
        onChange={set('mobile', (s) => s.replace(/\D/g, '').slice(0, 10))}
        error={errors.mobile}
        required
        autoComplete="off"
      />
      <Input label="यूज़रनेम" en="Username" hint={USERNAME_HINT} value={v.username} onChange={set('username')} maxLength={30} error={errors.username} required autoCapitalize="none" autoComplete="off" />
      {props.mode === 'create' ? (
        <>
          <span className="hidden sm:block" />
          <PasswordInput label="नया पासवर्ड" en="New password" hint={PASSWORD_HINT} value={v.password} onChange={set('password')} error={errors.password} required autoComplete="new-password" />
          <PasswordInput label="पासवर्ड दोबारा" en="Confirm password" value={v.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required autoComplete="new-password" />
        </>
      ) : null}
      <div className="sm:col-span-2"><ErrorBox error={error} /></div>
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={props.onCancel}>रद्द करें</Button>
        <Button type="submit" loading={busy}>{props.submitLabel}</Button>
      </div>
    </form>
  );
}
