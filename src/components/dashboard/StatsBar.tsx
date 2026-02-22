import { Card, CardContent } from '@/components/ui/card';
import { Users, Monitor, AlertTriangle, Zap } from 'lucide-react';

interface StatsBarProps {
  activeTeams: number;
  activeSessions: number;
  totalSessions: number;
  attentionCount: number;
  eventsToday: number;
}

const stats = [
  { key: 'teams', label: 'Active Teams', icon: Users, color: 'text-primary' },
  { key: 'sessions', label: 'Active Sessions', icon: Monitor, color: 'text-muted-foreground' },
  { key: 'attention', label: 'Need Attention', icon: AlertTriangle, color: 'text-status-yellow' },
  { key: 'events', label: 'Events Today', icon: Zap, color: 'text-muted-foreground' },
] as const;

export default function StatsBar({ activeTeams, activeSessions, totalSessions, attentionCount, eventsToday }: StatsBarProps) {
  const values: Record<string, string> = {
    teams: String(activeTeams),
    sessions: `${activeSessions} / ${totalSessions}`,
    attention: String(attentionCount),
    events: String(eventsToday),
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.key}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.key === 'attention' && attentionCount > 0 ? 'text-status-yellow' : 'text-foreground'}`}>
                  {values[stat.key]}
                </p>
              </div>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
