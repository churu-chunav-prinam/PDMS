import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { apiGet, apiPost, setCsrfToken } from './api/client';
import type { User } from './api/types';
import { navigate } from './router';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the logged-in user (e.g. after the admin changed their own username). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ user: User }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const onLoggedOut = () => setUser(null);
    window.addEventListener('poll:logged-out', onLoggedOut);
    return () => window.removeEventListener('poll:logged-out', onLoggedOut);
  }, []);

  // After login: new CSRF token, user set, and "/" shows that role's home.
  const finish = useCallback((r: { user: User; csrfToken: string }) => {
    setCsrfToken(r.csrfToken);
    setUser(r.user);
    navigate('/');
  }, []);
  const login = useCallback(
    async (username: string, password: string) => {
      finish(await apiPost<{ user: User; csrfToken: string }>('/api/auth/login', { username, password }));
    },
    [finish],
  );


  const refresh = useCallback(async () => {
    setUser((await apiGet<{ user: User }>('/api/auth/me')).user);
  }, []);

  const logout = useCallback(async () => {
    await apiPost('/api/auth/logout').catch(() => undefined);
    setCsrfToken(null);
    setUser(null);
    navigate('/');
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
