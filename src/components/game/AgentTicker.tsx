// ---------------------------------------------------------------------------
// AgentTicker — floating bottom-right rolling status ticker
// Shows what each active agent is currently doing, cycling through them.
// ---------------------------------------------------------------------------

import { useState, useEffect, useMemo } from 'react';
import { useOfficeAgents } from './useOfficeAgents';
import type { AgentStatus, SessionInfo } from './pixel-types';

// ---------------------------------------------------------------------------
// Theme (matches wood/parchment header)
// ---------------------------------------------------------------------------

const TICKER_STYLE = {
  bg: '#3D2B1F',
  text: '#F5ECD7',
  textDim: '#C4A265',
  border: '#5C3D2E',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TickerEntry {
  agentName: string;
  color: string;
  label: string;
}

interface AgentTickerProps {
  agentStatuses: Record<string, AgentStatus>;
  agentSessionInfos: Record<string, SessionInfo>;
}

// ---------------------------------------------------------------------------
// Build color map once
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentTicker({ agentStatuses, agentSessionInfos }: AgentTickerProps) {
  const officeAgents = useOfficeAgents();
  const AGENT_COLOR_MAP = useMemo(
    () => new Map(officeAgents.map((a) => [a.agentName, a.color])),
    [officeAgents],
  );
  const entries = useMemo<TickerEntry[]>(() => {
    const result: TickerEntry[] = [];
    for (const [name, status] of Object.entries(agentStatuses)) {
      if (status !== 'working') continue;
      const info = agentSessionInfos[name];
      result.push({
        agentName: name,
        color: AGENT_COLOR_MAP.get(name) ?? '#888',
        label: info?.taskName ?? 'Working...',
      });
    }
    return result;
  }, [agentStatuses, agentSessionInfos]);

  // Cycle through entries
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (entries.length <= 1) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % entries.length);
    }, 3000);
    return () => clearInterval(id);
  }, [entries.length]);

  if (entries.length === 0) return null;

  const current = entries[index % entries.length];
  if (!current) return null;

  return (
    <div
      className="absolute top-16 right-2 z-10 font-mono text-[10px] px-2 py-1 select-none pointer-events-none"
      style={{
        backgroundColor: TICKER_STYLE.bg,
        color: TICKER_STYLE.text,
        borderRadius: '2px',
        boxShadow: `0 0 0 1px ${TICKER_STYLE.border}, inset 1px 1px 0 0 #4A2F20`,
        maxWidth: '320px',
      }}
    >
      <div
        key={current.agentName}
        className="flex items-center gap-1.5 truncate"
        style={{ animation: 'tickerFadeIn 0.3s ease-out' }}
      >
        <span
          className="h-2 w-2 rounded-sm shrink-0"
          style={{ backgroundColor: current.color }}
        />
        <span className="font-semibold shrink-0" style={{ color: TICKER_STYLE.textDim }}>
          {current.agentName}
        </span>
        <span className="truncate">{current.label}</span>
        {entries.length > 1 && (
          <span className="shrink-0 ml-auto" style={{ color: TICKER_STYLE.textDim, opacity: 0.5 }}>
            {(index % entries.length) + 1}/{entries.length}
          </span>
        )}
      </div>
    </div>
  );
}
