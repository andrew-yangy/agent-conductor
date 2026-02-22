import { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import EventItem from './EventItem';

const EVENT_TYPE_FILTERS = ['all', 'stop', 'task_completed', 'teammate_idle', 'permission_prompt', 'idle_prompt', 'error'] as const;

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [showNewPill, setShowNewPill] = useState(false);
  const { events, teams } = useDashboardStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const prevEventCountRef = useRef(events.length);

  // Build session->team lookup
  const sessionTeamMap = new Map<string, string>();
  for (const team of teams) {
    if (team.leadSessionId) sessionTeamMap.set(team.leadSessionId, team.name);
    for (const m of team.members) {
      if (m.agentId) sessionTeamMap.set(m.agentId, team.name);
    }
  }

  // Filter events
  const filtered = events.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (teamFilter !== 'all') {
      const eventTeam = sessionTeamMap.get(e.sessionId);
      if (eventTeam !== teamFilter) return false;
    }
    return true;
  });

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  // Auto-scroll behavior
  const checkIsAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      wasAtBottomRef.current = checkIsAtBottom();
      if (wasAtBottomRef.current) setShowNewPill(false);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [checkIsAtBottom]);

  // When new events arrive
  useEffect(() => {
    if (events.length > prevEventCountRef.current) {
      if (wasAtBottomRef.current) {
        // Auto-scroll
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
      } else {
        setShowNewPill(true);
      }
    }
    prevEventCountRef.current = events.length;
  }, [events.length]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewPill(false);
  };

  // Snapshot time once per render for EventItem purity
  const now = globalThis.Date.now();

  // Get unique team names for filter
  const teamNames = [...new Set(teams.map((t) => t.name))];

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Filters bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border flex-wrap">
        {/* Type filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {EVENT_TYPE_FILTERS.map((type) => (
            <Badge
              key={type}
              variant={typeFilter === type ? 'default' : 'secondary'}
              className="cursor-pointer text-xs"
              onClick={() => setTypeFilter(type)}
            >
              {type === 'all' ? 'All' : type.replace('_', ' ')}
            </Badge>
          ))}
        </div>

        {/* Team filter */}
        {teamNames.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Badge
                variant={teamFilter === 'all' ? 'default' : 'secondary'}
                className="cursor-pointer text-xs"
                onClick={() => setTeamFilter('all')}
              >
                All teams
              </Badge>
              {teamNames.map((name) => (
                <Badge
                  key={name}
                  variant={teamFilter === name ? 'default' : 'secondary'}
                  className="cursor-pointer text-xs"
                  onClick={() => setTeamFilter(name)}
                >
                  {name}
                </Badge>
              ))}
            </div>
          </>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} events
        </div>
      </div>

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No events</p>
          </div>
        ) : (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const event = filtered[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <EventItem
                    event={event}
                    teamName={sessionTeamMap.get(event.sessionId)}
                    now={now}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* New events pill */}
        {showNewPill && (
          <Button
            variant="default"
            size="sm"
            className="absolute top-4 left-1/2 -translate-x-1/2 shadow-lg z-10"
            onClick={scrollToTop}
          >
            <ArrowDown className="h-3 w-3 mr-1" />
            New events
          </Button>
        )}
      </div>
    </div>
  );
}
