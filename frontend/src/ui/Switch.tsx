import { cn } from './cn';

/** On/off switch (role="switch"), 44px tap target. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid min-h-11 min-w-16 shrink-0 place-items-center rounded-full disabled:opacity-50"
    >
      <span className={cn('relative h-8 w-14 rounded-full transition-colors', checked ? 'bg-green-700' : 'bg-slate-300')}>
        <span className={cn('absolute left-0 top-1 size-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-7' : 'translate-x-1')} />
      </span>
    </button>
  );
}
