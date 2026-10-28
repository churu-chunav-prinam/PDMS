import { cn } from './cn';

/** Native <progress>: the bar width needs no inline style (strict CSP). */
export function ProgressBar({ value, max, tone = 'green', label, className }: { value: number; max: number; tone?: 'green' | 'saffron' | 'red'; label: string; className?: string }) {
  return <progress className={cn('progress-bar', tone !== 'green' && `tone-${tone}`, className)} max={Math.max(1, max)} value={value} aria-label={label} />;
}

const R = 42;
const C = 2 * Math.PI * R;

/** Circular progress (SVG attributes only). */
export function ProgressRing({ value, max, size = 112, children }: { value: number; max: number; size?: number; children?: React.ReactNode }) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative grid shrink-0 place-items-center" role="img" aria-label={`${value} / ${max}`}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" className="stroke-slate-200" />
        <circle
          cx="50" cy="50" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
          className={share === 1 ? 'stroke-green-600' : 'stroke-saffron-600'}
          strokeDasharray={`${C * share} ${C}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
