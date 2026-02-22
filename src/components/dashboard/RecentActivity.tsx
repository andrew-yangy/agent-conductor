import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { timeAgo, eventTypeBgColor } from '@/lib/utils';
import type { HookEvent } from '@/stores/types';

interface RecentActivityProps {
  events: HookEvent[];
}

export default function RecentActivity({ events }: RecentActivityProps) {
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs px-1.5 py-0.5 rounded ${eventTypeBgColor(event.type)}`}>
                  {event.type}
                </span>
                <span className="text-xs text-foreground truncate">{event.message}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {timeAgo(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
