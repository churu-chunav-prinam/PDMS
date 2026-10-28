import { useEffect, useState } from 'react';

/** "Now" on the server clock (offset from the last server time), ticking every 30 s. */
export function useServerNow(serverTime: string | undefined): number {
  const [offset, setOffset] = useState(0);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (serverTime !== undefined) setOffset(new Date(serverTime).getTime() - Date.now());
  }, [serverTime]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return Date.now() + offset;
}
