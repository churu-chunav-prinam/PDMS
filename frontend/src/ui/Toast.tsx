import { CheckCircle2, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from './cn';

interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  text: string;
}

const ToastContext = createContext<((tone: ToastItem['tone'], text: string) => void) | null>(null);
const TOAST_MS = 4000;

/** Short confirmations ("सहेजा गया") at the bottom; announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((tone: ToastItem['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, tone, text }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-raised',
              t.tone === 'success' ? 'bg-green-800' : 'bg-red-800',
            )}
          >
            {t.tone === 'success' ? <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /> : <XCircle className="size-5 shrink-0" aria-hidden="true" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
