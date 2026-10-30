import { useEffect, useState } from 'react';

/** Shown while a request is slow because the free server is starting up (see api/client.ts). */
export function WakeBanner() {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    const onWaking = (e: Event) => setWaking((e as CustomEvent<boolean>).detail);
    window.addEventListener('poll:waking', onWaking);
    return () => window.removeEventListener('poll:waking', onWaking);
  }, []);
  if (!waking) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-saffron-100 px-4 py-3 text-center font-medium text-saffron-800 shadow-raised"
    >
      सर्वर शुरू हो रहा है, कृपया 1 मिनट रुकें…
    </div>
  );
}
