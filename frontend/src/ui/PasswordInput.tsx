import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { Field, inputClass } from './Field';

/** Password field with a show/hide toggle (its label never contains "पासवर्ड", so labels stay unique). */
export function PasswordInput({
  label,
  en,
  hint,
  error,
  className,
  ...rest
}: { label: string; en?: string; hint?: string | undefined; error?: string | null | undefined } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} en={en} hint={hint} error={error}>
      {(id, describedBy) => (
        <div className="relative">
          <input
            id={id}
            type={show ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn(inputClass(false, !!error), 'pr-14', className)}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'छिपाएँ (hide)' : 'दिखाएँ (show)'}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 grid min-h-11 w-12 place-items-center rounded-r-xl text-slate-600 hover:text-slate-900"
          >
            {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
}
