import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

type AlertTone = 'info' | 'success' | 'warning' | 'error';
const STYLE: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  info: { box: 'bg-saffron-50 text-saffron-800 ring-saffron-200', Icon: Info },
  success: { box: 'bg-green-50 text-green-800 ring-green-200', Icon: CheckCircle2 },
  warning: { box: 'bg-amber-50 text-amber-800 ring-amber-200', Icon: AlertTriangle },
  error: { box: 'bg-red-50 text-red-800 ring-red-200', Icon: XCircle },
};

export function Alert({ tone = 'info', children, className }: { tone?: AlertTone; children: ReactNode; className?: string }) {
  const { box, Icon } = STYLE[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl p-3.5 text-sm font-medium ring-1 ring-inset', box, className)} role={tone === 'error' ? 'alert' : undefined}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
