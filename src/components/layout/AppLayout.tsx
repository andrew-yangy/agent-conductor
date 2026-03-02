import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import SearchCommandPalette from '@/components/shared/SearchCommandPalette';
import { useDashboardStore } from '@/stores/dashboard-store';

export default function AppLayout() {
  const workState = useDashboardStore((s) => s.workState);
  const fetchedRef = useRef(false);

  // Eagerly fetch work state on app load so orientation banner + search have data
  useEffect(() => {
    if (workState?.goals || fetchedRef.current) return;
    fetchedRef.current = true;
    Promise.all([
      fetch('http://localhost:4444/api/state/goals').then(r => r.json()).catch(() => null),
      fetch('http://localhost:4444/api/state/features').then(r => r.json()).catch(() => null),
      fetch('http://localhost:4444/api/state/backlogs').then(r => r.json()).catch(() => null),
      fetch('http://localhost:4444/api/state/conductor').then(r => r.json()).catch(() => null),
    ]).then(([goals, features, backlogs, conductor]) => {
      if (goals?.goals) {
        const current = useDashboardStore.getState().workState;
        useDashboardStore.getState().setWorkState({
          goals: current?.goals ?? goals,
          features: current?.features ?? features,
          backlogs: current?.backlogs ?? backlogs,
          conductor: current?.conductor ?? conductor,
          index: current?.index ?? null,
        });
      }
    });
  }, [workState?.goals]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <SearchCommandPalette />
    </div>
  );
}
