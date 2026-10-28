import { Suspense, lazy, useEffect } from 'react';
import { useAuth } from './auth';
import { Skeleton } from './ui';
import { LandingPage } from './pages/LandingPage';
import { AdminLoginPage } from './pages/login/AdminLoginPage';
import { OfficerLoginPage } from './pages/login/OfficerLoginPage';
import { HistoryPage } from './pages/officer/HistoryPage';
import { IssueNewPage } from './pages/officer/IssueNewPage';
import { IssuesPage } from './pages/officer/IssuesPage';
import { OfficerHome } from './pages/officer/OfficerHome';
import { PhasePage } from './pages/officer/PhasePage';
import { StepPage } from './pages/officer/StepPage';
import type { Phase } from './api/types';
import { PHASE_ORDER } from './labels';
import { matchRoute, usePath } from './router';

const isPhase = (v: string | undefined): v is Phase => PHASE_ORDER.includes(v as Phase);

function OfficerScreen({ path }: { path: string }) {
  const phase = matchRoute('/phase/:phase', path);
  if (isPhase(phase?.phase)) return <PhasePage phase={phase.phase} />;
  const step = matchRoute('/step/:phase/:id', path);
  if (isPhase(step?.phase) && Number(step.id) > 0) return <StepPage phase={step.phase} stepId={Number(step.id)} />;
  if (path === '/issue/new') return <IssueNewPage />;
  if (path === '/issues') return <IssuesPage />;
  if (path === '/history') return <HistoryPage />;
  return <OfficerHome />;
}

// The district screens are a separate chunk (officers never load them).
const AdminApp = lazy(() => import('./AdminApp'));

function Loading() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4" role="status" aria-label="लोड हो रहा है">
      <Skeleton className="h-14" />
      <Skeleton className="h-40" />
    </div>
  );
}

/** Logged out: the two login pages, everything else (old URLs included) is the landing page. */
const PUBLIC_ROUTES: Record<string, () => React.JSX.Element> = {
  '/login/admin': AdminLoginPage,
  '/login/officer': OfficerLoginPage,
};

function PublicScreen({ path }: { path: string }) {
  const Screen = PUBLIC_ROUTES[path];
  useEffect(() => {
    if (!Screen && path !== '/') window.history.replaceState(null, '', '#/');
  }, [Screen, path]);
  return Screen ? <Screen /> : <LandingPage />;
}

export function App() {
  const { user, loading } = useAuth();
  const path = usePath();
  if (loading) return <Loading />;
  if (!user) return <PublicScreen key={path} path={path} />;
  if (user.role === 'DISTRICT_ADMIN') {
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp key={path} path={path} />
      </Suspense>
    );
  }
  return <OfficerScreen key={path} path={path} />;
}
