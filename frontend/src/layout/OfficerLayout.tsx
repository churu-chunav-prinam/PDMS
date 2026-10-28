import type { ReactNode } from 'react';
import { TopBar } from './TopBar';

/** Officer screens: one calm column, phone-first, centred on wide screens, safe bottom spacing. */
export function OfficerLayout({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <TopBar narrow title={title} {...(subtitle !== undefined ? { subtitle } : {})} {...(back !== undefined ? { back } : {})} />
      <main className="safe-bottom mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4">{children}</main>
    </div>
  );
}
