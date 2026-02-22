import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';

// Lazy load pages for code splitting
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('@/components/dashboard/DashboardPage'));
const TeamDetail = lazy(() => import('@/components/teams/TeamDetail'));
const SessionsPage = lazy(() => import('@/components/sessions/SessionsPage'));
const ActivityPage = lazy(() => import('@/components/activity/ActivityPage'));
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'));

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
      { path: 'sessions', element: <SuspenseWrapper><SessionsPage /></SuspenseWrapper> },
      { path: 'activity', element: <SuspenseWrapper><ActivityPage /></SuspenseWrapper> },
      { path: 'settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
    ],
  },
]);
