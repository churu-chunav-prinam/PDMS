import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui';

/** Cards rendered per step: keeps phones on slow networks responsive. */
export const PAGE_SIZE = 24;

/** Shows `items` 24 at a time; resets to the first page when `resetKey` changes. */
export function usePaged<T>(items: readonly T[] | null, resetKey: string) {
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => setShown(PAGE_SIZE), [resetKey]);
  const rest = Math.max(0, (items?.length ?? 0) - shown);
  const more =
    rest > 0 ? (
      <Button variant="secondary" block icon={<ChevronDown className="size-5" aria-hidden="true" />} onClick={() => setShown(shown + PAGE_SIZE)}>
        और देखें ({rest})
      </Button>
    ) : null;
  return { visible: items?.slice(0, shown) ?? [], more };
}
