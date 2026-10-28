import { useEffect, useState } from 'react';

// Tiny hash router: "#/admin/officers" -> "/admin/officers". No dependency, works from any path.
export function currentPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/** "/step/:phase/:id" against "/step/POLL_DAY/12" -> { phase: 'POLL_DAY', id: '12' }, else null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const a = path.split('?')[0]?.split('/') ?? [];
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (const [i, part] of p.entries()) {
    const actual = a[i] ?? '';
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(actual);
    else if (part !== actual) return null;
  }
  return params;
}
