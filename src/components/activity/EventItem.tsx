import { Badge } from '@/components/ui/badge';
import { timeAgo, eventTypeBgColor, formatFullDate } from '@/lib/utils';
import type { HookEvent } from '@/stores/types';

interface EventItemProps {
  event: HookEvent;
  teamName?: string;
  now?: number;
}

export default function EventItem({ event, teamName, now }: EventItemProps) {
  const eventDate = new Date(event.timestamp);
  const isRecent = (now ?? eventDate.getTime()) - eventDate.getTime() < 60 * 60 * 1000;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 hover:bg-secondary/30 border-b border-border/50">
      {/* Type badge */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${eventTypeBgColor(event.type)}`}>
        {event.type.replace('_', ' ')}
      </span>

      {/* Message */}
      <span className="text-xs text-foreground truncate flex-1">{event.message}</span>

      {/* Session/Team info */}
      <div className="flex items-center gap-2 shrink-0">
        {teamName && (
          <Badge variant="secondary" className="text-[10px]">{teamName}</Badge>
        )}
        <span className="text-[10px] text-muted-foreground font-mono">
          {event.sessionId.slice(0, 8)}
        </span>
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right" title={formatFullDate(event.timestamp)}>
        {isRecent ? timeAgo(event.timestamp) : eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
