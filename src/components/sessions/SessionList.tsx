import { useDashboardStore } from '../../stores/dashboard-store';
import SessionCard from './SessionCard';

const STATUS_ORDER: Record<string, number> = {
  'waiting-approval': 0,
  'waiting-input': 1,
  error: 2,
  working: 3,
  idle: 4,
};

export default function SessionList() {
  const sessions = useDashboardStore((s) => s.sessions);

  const sorted = [...sessions].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  );

  const statusCounts = sessions.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text">Sessions</h2>
        <div className="flex items-center gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} className="text-xs text-text-dim font-mono">
              {count} {status}
            </span>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center">
          <span className="text-3xl text-text-dim mb-3">{'\u25c9'}</span>
          <p className="text-sm text-text-muted mb-1">No active sessions</p>
          <p className="text-xs text-text-dim">
            Sessions appear when Claude Code agents are running
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
