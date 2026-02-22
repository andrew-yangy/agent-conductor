import { useDashboardStore } from '../../stores/dashboard-store';
import EventItem from './EventItem';

export default function EventTimeline() {
  const events = useDashboardStore((s) => s.events);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text">Activity</h2>
        <span className="text-xs text-text-dim font-mono">
          {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center">
          <span className="text-3xl text-text-dim mb-3">{'\u25b7'}</span>
          <p className="text-sm text-text-muted mb-1">No events recorded</p>
          <p className="text-xs text-text-dim">
            Events are captured from Claude Code hooks
          </p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border-subtle">
          {events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
