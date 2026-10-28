import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import type { ButtonVariant } from './Button';

/** Native modal <dialog>: focus trap, Esc to close and backdrop come from the browser. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-surface p-0 text-slate-900 shadow-raised backdrop:bg-slate-900/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  variant?: ButtonVariant;
}

const ConfirmContext = createContext<((r: ConfirmRequest) => Promise<boolean>) | null>(null);

/** One confirm dialog for the whole app: `if (!(await confirm({...}))) return;` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null);
  const confirm = useCallback((r: ConfirmRequest) => new Promise<boolean>((resolve) => setRequest({ ...r, resolve })), []);
  const answer = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={request !== null} title={request?.title ?? ''} onClose={() => answer(false)}>
        {request?.message && <p className="text-slate-700">{request.message}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => answer(false)}>रद्द करें</Button>
          <Button variant={request?.variant ?? 'primary'} onClick={() => answer(true)}>{request?.confirmLabel ?? 'हाँ, आगे बढ़ें'}</Button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm outside ConfirmProvider');
  return ctx;
}
