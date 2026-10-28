import { AlertTriangle, ChevronLeft, FileSpreadsheet, LayoutDashboard, ListChecks, LogOut, ScrollText, Settings, UserCog, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { usePath } from '../router';
import { cn } from '../ui';
import { TopBar } from './TopBar';

interface NavItem {
  path: string;
  hi: string;
  en: string;
  Icon: LucideIcon;
  /** Shown in the phone bottom bar (max 5). */
  phone: boolean;
}

const NAV: readonly NavItem[] = [
  { path: '/', hi: 'डैशबोर्ड', en: 'Dashboard', Icon: LayoutDashboard, phone: true },
  { path: '/admin/issues', hi: 'समस्याएँ', en: 'Open issues', Icon: AlertTriangle, phone: true },
  { path: '/admin/officers', hi: 'अधिकारी', en: 'Officer accounts', Icon: Users, phone: true },
  { path: '/admin/bulk', hi: 'Excel से जोड़ें', en: 'Bulk add', Icon: FileSpreadsheet, phone: false },
  { path: '/admin/steps', hi: 'चरण सूची', en: 'Step master', Icon: ListChecks, phone: true },
  { path: '/admin/settings', hi: 'सेटिंग', en: 'Settings', Icon: Settings, phone: true },
  { path: '/admin/audit', hi: 'ऑडिट लॉग', en: 'Audit log', Icon: ScrollText, phone: false },
  { path: '/admin/profile', hi: 'मेरा खाता', en: 'My account', Icon: UserCog, phone: false },
];

/** The nav item a path belongs to (booth and pending pages belong to the dashboard). */
function activeOf(path: string): string {
  const exact = NAV.find((n) => n.path !== '/' && path.startsWith(n.path));
  return exact?.path ?? '/';
}

/** District screens: sidebar on desktop, top bar + bottom navigation on phones. */
export function AdminLayout({ title, subtitle, back, actions, children }: { title: string; subtitle?: string; back?: string; actions?: ReactNode; children: ReactNode }) {
  const { logout } = useAuth();
  const active = activeOf(usePath());
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="tricolour h-1" aria-hidden="true" />
        <div className="px-5 py-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-saffron-800">जिला चूरू</div>
          <div className="text-lg font-bold leading-tight">ज़िला नियंत्रण कक्ष</div>
          <div className="text-xs text-slate-600">Poll Day Monitoring</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="मुख्य मेनू">
          {NAV.map(({ path, hi, en, Icon }) => (
            <a
              key={path}
              href={`#${path}`}
              aria-current={active === path ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold',
                active === path ? 'bg-saffron-50 text-saffron-800 ring-1 ring-saffron-200' : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span>
                {hi}
                <span className="block text-xs font-normal text-slate-600">{en}</span>
              </span>
            </a>
          ))}
        </nav>
        <div className="p-3">
          <button type="button" onClick={() => void logout()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <LogOut className="size-5" aria-hidden="true" />
            लॉग आउट
          </button>
        </div>
      </aside>

      <TopBar title={title} {...(subtitle !== undefined ? { subtitle } : {})} {...(back !== undefined ? { back } : {})} className="lg:hidden" />

      <div className="lg:pl-64">
        <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-8">
          <div className="hidden items-start justify-between gap-4 lg:flex">
            <div className="flex items-center gap-2">
              {back !== undefined && (
                <a href={`#${back}`} aria-label="वापस / Back" className="grid size-11 place-items-center rounded-xl text-slate-700 ring-1 ring-line hover:bg-white">
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </a>
              )}
              <div>
                <h1 className="text-2xl font-bold">{title}</h1>
                {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
              </div>
            </div>
            {actions}
          </div>
          {actions && <div className="lg:hidden">{actions}</div>}
          {children}
        </main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-1 pt-1 backdrop-blur lg:hidden" aria-label="मुख्य मेनू">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((n) => n.phone).map(({ path, hi, Icon }) => (
            <a
              key={path}
              href={`#${path}`}
              aria-current={active === path ? 'page' : undefined}
              className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-semibold', active === path ? 'text-saffron-800' : 'text-slate-600')}
            >
              <Icon className={cn('size-6', active === path && 'stroke-[2.5]')} aria-hidden="true" />
              {hi}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
