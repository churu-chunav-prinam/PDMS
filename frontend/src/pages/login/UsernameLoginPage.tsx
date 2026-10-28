import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth';
import { Input } from '../../ui';
import { LoginForm } from './LoginForm';

/** Username + password login. Both role cards use it; the server decides what the account may do. */
export function UsernameLoginPage({ titleHi, titleEn, icon }: { titleHi: string; titleEn: string; icon: ReactNode }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  return (
    <LoginForm titleHi={titleHi} titleEn={titleEn} icon={icon} canSubmit={username.trim() !== ''} onSubmit={(pw) => login(username.trim(), pw)}>
      <Input label="यूज़रनेम" en="Username" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
    </LoginForm>
  );
}
