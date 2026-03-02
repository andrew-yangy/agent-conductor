import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, Zap, Pause } from 'lucide-react';

interface SchedulerConfig {
  enabled: boolean;
  check_interval_minutes: number;
  max_concurrent_sessions: number;
  daily_budget: {
    max_cost_usd: number;
  };
  quiet_hours: {
    start: string;
    end: string;
  };
  project_path: string;
}

interface LogEntry {
  timestamp: string;
  action: 'launch' | 'skip' | 'error' | 'check';
  directive?: string;
  priority?: string;
  reason?: string;
  estimated_cost_usd?: number;
}

interface SchedulerState {
  config: SchedulerConfig | null;
  todaySpend: number;
  lastRun: string | null;
  recentEntries: LogEntry[];
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function actionBadge(entry: LogEntry) {
  switch (entry.action) {
    case 'launch':
      return <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px] px-1.5 py-0">launched</Badge>;
    case 'skip':
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entry.reason?.replace(/_/g, ' ') ?? 'skipped'}</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">error</Badge>;
    case 'check':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">checked</Badge>;
  }
}

export default function SchedulerCard() {
  const [state, setState] = useState<SchedulerState | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchState = useCallback(() => {
    fetch('http://localhost:4444/api/scheduler')
      .then(r => r.json())
      .then(data => setState(data))
      .catch(() => setState(null));
  }, []);

  useEffect(() => {
    fetchState();
    // Refresh every 30 seconds
    const interval = setInterval(fetchState, 30000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      await fetch('http://localhost:4444/api/scheduler/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      fetchState();
    } finally {
      setToggling(false);
    }
  };

  // No config yet — scheduler hasn't been initialized
  if (!state?.config) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Autopilot</h3>
            <Badge variant="outline" className="text-[10px]">not configured</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Run <code className="bg-muted px-1 py-0.5 rounded text-[10px]">scripts/foreman.sh</code> to initialize.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { config, todaySpend, lastRun, recentEntries } = state;
  const enabled = config.enabled;
  const budgetPct = config.daily_budget.max_cost_usd > 0
    ? Math.min(100, Math.round((todaySpend / config.daily_budget.max_cost_usd) * 100))
    : 0;
  const budgetRemaining = Math.max(0, config.daily_budget.max_cost_usd - todaySpend);

  // Recent launches (not skips/checks)
  const launches = recentEntries.filter(e => e.action === 'launch');

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header with toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
            <h3 className="text-sm font-medium">Autopilot</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{enabled ? 'On' : 'Off'}</span>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Budget */}
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Budget left</p>
              <p className="text-sm font-medium">${budgetRemaining.toFixed(0)}</p>
            </div>
          </div>

          {/* Budget bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-full">
              <p className="text-[10px] text-muted-foreground mb-0.5">Spent today</p>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${budgetPct > 80 ? 'bg-red-500' : budgetPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Last run */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Last check</p>
              <p className="text-sm font-medium">{lastRun ? formatRelativeTime(lastRun) : 'never'}</p>
            </div>
          </div>
        </div>

        {/* Quiet hours indicator */}
        <div className="flex items-center gap-1.5 mb-3">
          <Pause className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Quiet hours: {config.quiet_hours.start} - {config.quiet_hours.end}
          </span>
        </div>

        {/* Recent activity */}
        {recentEntries.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Today's activity</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {recentEntries.slice(-5).reverse().map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {actionBadge(entry)}
                    <span className="text-muted-foreground truncate max-w-[180px]">
                      {entry.directive ?? entry.reason?.replace(/_/g, ' ') ?? entry.action}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's launches summary */}
        {launches.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              {launches.length} directive{launches.length > 1 ? 's' : ''} launched today
              {todaySpend > 0 && ` (~$${todaySpend.toFixed(2)} est.)`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
