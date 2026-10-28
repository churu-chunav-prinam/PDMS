import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const CONTROL =
  'block w-full rounded-xl border-0 bg-white px-3.5 text-base text-slate-900 ring-1 ring-inset ring-line-strong ' +
  'placeholder:text-slate-500 focus:ring-2 focus:ring-saffron-700 focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export const inputClass = (big = false, invalid = false) =>
  cn(CONTROL, big ? 'min-h-16 text-center text-3xl font-bold tabular-nums' : 'min-h-12', invalid && 'ring-2 ring-red-600');

interface FieldProps {
  label: ReactNode;
  /** Small English line under the Hindi label. */
  en?: string | undefined;
  hint?: ReactNode | undefined;
  error?: string | null | undefined;
  /** Left marker inside the label, e.g. a step number (hidden from screen readers). */
  marker?: ReactNode | undefined;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({ label, en, hint, error, marker, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {marker}
        <label htmlFor={id} className="font-semibold text-slate-800">
          {label}
          {en && <span className="block text-xs font-normal text-slate-600">{en}</span>}
        </label>
      </div>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-sm text-slate-600">{hint}</p>
      )}
    </div>
  );
}

type Labelled = Omit<FieldProps, 'children'>;

export function Input({ label, en, hint, error, marker, big, className, ...rest }: Labelled & { big?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} en={en} hint={hint} error={error} marker={marker}>
      {(id, d) => <input id={id} aria-describedby={d} aria-invalid={error ? true : undefined} className={cn(inputClass(big, !!error), className)} {...rest} />}
    </Field>
  );
}

export function Select({ label, en, hint, error, marker, className, children, ...rest }: Labelled & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} en={en} hint={hint} error={error} marker={marker}>
      {(id, d) => (
        <select id={id} aria-describedby={d} aria-invalid={error ? true : undefined} className={cn(inputClass(false, !!error), 'pr-10', className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function TextArea({ label, en, hint, error, marker, className, ...rest }: Labelled & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} en={en} hint={hint} error={error} marker={marker}>
      {(id, d) => <textarea id={id} aria-describedby={d} className={cn(CONTROL, 'py-3', className)} rows={3} {...rest} />}
    </Field>
  );
}
