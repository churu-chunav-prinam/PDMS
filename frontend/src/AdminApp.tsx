// District (DISTRICT_ADMIN) screens. Loaded lazily from App.tsx, so officers on slow phones
// never download this code.
import { BulkPage } from './pages/admin/BulkPage';
import { OfficersPage } from './pages/admin/OfficersPage';
import { AuditPage } from './pages/district/AuditPage';
import { BoothPage } from './pages/district/BoothPage';
import { DashboardPage } from './pages/district/DashboardPage';
import { IssuesListPage } from './pages/district/IssuesListPage';
import { PendingPage } from './pages/district/PendingPage';
import { SettingsPage } from './pages/district/SettingsPage';
import { StepMasterPage } from './pages/district/StepMasterPage';
import { ProfilePage } from './pages/admin/ProfilePage';
import { matchRoute } from './router';

const ADMIN_ROUTES: Record<string, () => React.JSX.Element> = {
  '/admin/officers': OfficersPage,
  '/admin/bulk': BulkPage,
  '/admin/issues': IssuesListPage,
  '/admin/steps': StepMasterPage,
  '/admin/settings': SettingsPage,
  '/admin/audit': AuditPage,
  '/admin/profile': ProfilePage,
};

export default function AdminApp({ path }: { path: string }) {
  const booth = matchRoute('/admin/booth/:id', path);
  if (booth && Number(booth.id) > 0) return <BoothPage boothId={Number(booth.id)} />;
  const pending = matchRoute('/admin/step/:id/pending', path);
  if (pending && Number(pending.id) > 0) return <PendingPage stepId={Number(pending.id)} />;
  const Screen = ADMIN_ROUTES[path] ?? DashboardPage;
  return <Screen />;
}
