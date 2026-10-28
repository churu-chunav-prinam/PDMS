import { cn } from '../ui';

/** Filter chips (single choice). 44px tall tap targets. */
export function Chips<T extends string>({ options, value, onChange }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="फ़िल्टर">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition',
            value === v ? 'bg-saffron-700 text-white ring-saffron-700' : 'bg-surface text-slate-700 ring-line-strong hover:bg-saffron-50',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
