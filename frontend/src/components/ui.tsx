import { useCallback, useEffect, useState } from 'react';
import { errorText, problemLines } from '../api/messages';
import { Alert } from '../ui';

/** Hindi first, small English below. */
export function Bi({ hi, en, className }: { hi: string; en: string; className?: string }) {
  return (
    <span className={className}>
      <span className="block">{hi}</span>
      <span className="block text-[0.8em] font-normal opacity-80">{en}</span>
    </span>
  );
}

/** Friendly Hindi error for any API error (rule problems one per line). */
export function ErrorBox({ error }: { error: unknown }) {
  if (error === null || error === undefined) return null;
  const lines = problemLines(error);
  return <Alert tone="error">{lines.length > 0 ? lines.map((l) => <div key={l}>{l}</div>) : errorText(error)}</Alert>;
}

/** Loads data with a reload() handle. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    setError(null);
    run().then(setData, setError);
  }, [run]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

/** useLoad that also reloads every `ms` while the tab is visible (dashboard auto refresh). */
export function useAutoLoad<T>(load: () => Promise<T>, deps: readonly unknown[], ms: number) {
  const state = useLoad(load, deps);
  const { reload } = state;
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, ms);
    return () => clearInterval(t);
  }, [reload, ms]);
  return state;
}
