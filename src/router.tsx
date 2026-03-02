import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';

// Lazy load pages for code splitting
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('@/components/dashboard/DashboardPage'));
const TeamDetail = lazy(() => import('@/components/teams/TeamDetail'));
const SessionsPage = lazy(() => import('@/components/sessions/SessionsPage'));
const InsightsPage = lazy(() => import('@/components/insights/InsightsPage'));
const HistoryPage = lazy(() => import('@/components/insights/HistoryPage'));
const PlansPage = lazy(() => import('@/components/insights/PlansPage'));
const ProjectsPage = lazy(() => import('@/components/projects/ProjectsPage'));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));
const ArtifactsPage = lazy(() => import('@/components/artifacts/ArtifactsPage'));
const OrgPage = lazy(() => import('@/components/org/OrgPage'));
const AgentDetailPage = lazy(() => import('@/components/org/AgentDetailPage'));

// eslint-disable-next-line react-refresh/only-export-components
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper> },
      { path: 'teams/:name', element: <SuspenseWrapper><TeamDetail /></SuspenseWrapper> },
      { path: 'org', element: <SuspenseWrapper><OrgPage /></SuspenseWrapper> },
      { path: 'org/:agentId', element: <SuspenseWrapper><AgentDetailPage /></SuspenseWrapper> },
      { path: 'projects', element: <SuspenseWrapper><ProjectsPage /></SuspenseWrapper> },
      { path: 'sessions', element: <SuspenseWrapper><SessionsPage /></SuspenseWrapper> },
      { path: 'insights', element: <SuspenseWrapper><InsightsPage /></SuspenseWrapper> },
      { path: 'history', element: <SuspenseWrapper><HistoryPage /></SuspenseWrapper> },
      { path: 'plans', element: <SuspenseWrapper><PlansPage /></SuspenseWrapper> },
      { path: 'artifacts', element: <SuspenseWrapper><ArtifactsPage /></SuspenseWrapper> },
      { path: 'settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
    ],
  },
]);
