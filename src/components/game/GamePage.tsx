import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useAgentRegistryStore } from '@/stores/agent-registry-store';
import { type SelectedItem, type InteractionType } from './types';
import { useOfficeAgents } from './useOfficeAgents';
import type { AgentStatus, SessionInfo } from './pixel-types';
import GameHeader, { type HudPanel } from './GameHeader';
import CanvasOffice, { type ClickedItem } from './CanvasOffice';
import SidePanel from './SidePanel';
import AgentTicker from './AgentTicker';
import type { TileType } from './types';
import type { Session, DirectiveState } from '@/stores/types';
import { getZoneAt } from './engine/roomZones';

/** Capitalize first letter — agent names in project.json are lowercase ("riley") */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert a meaningful session slug to a display name.
 *  Skips random 3-word slugs (like "quirky-braving-key") by requiring 4+ words. */
function formatSlug(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  const words = slug.split('-');
  if (words.length < 4) return undefined; // random slugs are typically 3 words
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Extract a meaningful task name from a session's initialPrompt.
 *  Strips preambles like "You are Riley Kim, Frontend Developer." and
 *  "MODE: Independent Code Review..." to get the actual task description. */
function extractTaskName(prompt?: string | null): string | undefined {
  if (!prompt) return undefined;
  let text = prompt;
  // Strip "MODE: ..." as a label (keep the description after it)
  const modeMatch = text.match(/^MODE:\s*([^\n]+)/);
  if (modeMatch) return modeMatch[1].trim().slice(0, 60);
  // Strip "You are [Name Surname], [Role]." — greedy match to the first period
  text = text.replace(/^You are [A-Z][^\n.]*\.\s*/, '');
  // Strip "You are the [Role]." (e.g. "You are the COO.")
  text = text.replace(/^You are the [A-Za-z/\- ]+\.\s*/, '');
  // Strip "You are operating in [MODE]."
  text = text.replace(/^You are operating in [A-Z_ ]+\.\s*/, '');
  // Strip "You are decomposing..."
  text = text.replace(/^You are (decomposing|reviewing|executing|performing)\s+/, '$1 ');
  // Strip past-tense "You proposed/completed/..."
  text = text.replace(/^You (proposed|completed|finished|started)\s+/, '$1 ');
  // Strip directive-style preamble: "Execute all N tasks below..." or "Complete the following..."
  text = text.replace(/^(Execute|Complete|Implement|Perform|Run)\s+(all\s+)?\d*\s*(tasks?|items?|steps?)\s+(below|listed|described|following)[^.\n]*\.\s*/i, '');
  // Strip "The CEO has/is issued/directing/requesting..."
  text = text.replace(/^The CEO\s+[^.\n]*\.\s*/i, '');
  // Strip "You are being spawned..." test preambles
  text = text.replace(/^You are being spawned[^.\n]*\.\s*/i, '');
  // Strip "You are reviewing/auditing/executing..."
  text = text.replace(/^You are (reviewing|auditing|executing|building|implementing)[^.\n]*\.\s*/i, '');
  // Strip "You have N (sequential) tasks..."
  text = text.replace(/^You have \d+\s*(sequential\s+)?tasks?[^.\n]*\.\s*/i, '');
  text = text.trim();
  if (text.length === 0) return undefined;
  // Take first sentence only
  const firstSentence = text.match(/^[^.!?\n]+/)?.[0]?.trim();
  if (!firstSentence || firstSentence.length < 5) return undefined;
  const result = firstSentence[0].toUpperCase() + firstSentence.slice(1);
  return result.length > 60 ? result.slice(0, 57) + '...' : result;
}

// ---------------------------------------------------------------------------
// Furniture-to-HUD-tab mapping
// When a furniture click resolves to one of these TileTypes, open the
// corresponding HUD tab instead of the furniture-specific panel.
// ---------------------------------------------------------------------------

const FURNITURE_TAB_MAP: Partial<Record<TileType, HudPanel>> = {
  'ceo-desk':    'tasks',      // CEO desk -> Tasks tab
  'whiteboard':  'tasks',      // Whiteboard -> Tasks tab (directives merged in)
  'conference':  'status',     // Conference room -> Status tab (company overview)
  'server-room': 'team',      // Server room -> Team tab (sessions)
};

// ---------------------------------------------------------------------------
// Mobile breakpoint
// ---------------------------------------------------------------------------

const MOBILE_BREAKPOINT = 768;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

// ---------------------------------------------------------------------------
// Map session status -> simplified AgentStatus
// ---------------------------------------------------------------------------

function toAgentStatus(sessionStatus: string): AgentStatus {
  switch (sessionStatus) {
    case 'working':
    case 'waiting-approval':
    case 'waiting-input':
      return 'working';
    default:
      return 'idle';
  }
}

// ---------------------------------------------------------------------------
// Pixel-art overlay styles
// ---------------------------------------------------------------------------

const PIXEL_BORDER_STYLE = {
  boxShadow: 'inset -2px -2px 0 0 #8B6914, inset 2px 2px 0 0 #F5ECD7',
} as const;

// ---------------------------------------------------------------------------
// ControlsHint (Task 6)
// ---------------------------------------------------------------------------

function ControlsHint() {
  return (
    <div
      className="absolute bottom-2 right-2 z-10 font-mono text-[10px] px-2 py-1 pointer-events-none select-none"
      style={{
        backgroundColor: '#3D2B1F',
        color: '#C4A265',
        borderRadius: '2px',
        boxShadow: '0 0 0 1px #5C3D2E, inset 1px 1px 0 0 #4A2F20',
      }}
    >
      WASD / Arrows: Move&nbsp;&nbsp;|&nbsp;&nbsp;Click: Interact
    </div>
  );
}

// ---------------------------------------------------------------------------
// GamePage
// ---------------------------------------------------------------------------

export default function GamePage() {
  // Fetch agent registry on mount
  const fetchRegistry = useAgentRegistryStore((s) => s.fetchRegistry);
  useEffect(() => { fetchRegistry(); }, [fetchRegistry]);

  const OFFICE_AGENTS = useOfficeAgents();
  const KNOWN_AGENTS = useMemo(() => new Set(OFFICE_AGENTS.map((a) => a.agentName)), [OFFICE_AGENTS]);

  // Keep a ref for use in callbacks that shouldn't re-create on agents change
  const officeAgentsRef = useRef(OFFICE_AGENTS);
  officeAgentsRef.current = OFFICE_AGENTS;

  const sessions = useDashboardStore((s) => s.sessions);
  const sessionActivities = useDashboardStore((s) => s.sessionActivities);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Derive agent interactions from directive pipeline state
  // Uses semantic relationships (builder↔reviewer, planners in meeting) instead of session parent/child
  const activeDirectives = useDashboardStore((s) => s.activeDirectives);

  // Derive agent statuses from sessions + directive pipeline state
  // Agents actively participating in a directive step show as 'working' even if their session is idle
  const agentStatuses = useMemo<Record<string, AgentStatus>>(() => {
    const map: Record<string, AgentStatus> = {};
    for (const name of KNOWN_AGENTS) {
      map[name] = 'idle';
    }
    const priority: Record<AgentStatus, number> = { working: 1, idle: 0 };
    for (const s of sessions) {
      if (s.agentName && KNOWN_AGENTS.has(s.agentName)) {
        const status = toAgentStatus(s.status);
        if (priority[status] > priority[map[s.agentName]]) {
          map[s.agentName] = status;
        }
      }
    }
    // Override: agents actively involved in a directive step show as working
    for (const directive of activeDirectives) {
      const step = directive.currentStepId ?? '';
      if (['plan', 'brainstorm', 'challenge', 'project-brainstorm'].includes(step)) {
        map['Morgan'] = 'working';
        if (['brainstorm', 'challenge', 'project-brainstorm'].includes(step)) {
          map['Sarah'] = 'working';
        }
        if (step === 'project-brainstorm') {
          for (const proj of directive.projects) {
            for (const t of proj.tasks ?? []) {
              if (t.agent) { const n = capitalize(t.agent); if (KNOWN_AGENTS.has(n)) map[n] = 'working'; }
            }
          }
        }
      }
      if (step === 'execute') {
        for (const proj of directive.projects) {
          if (proj.status !== 'in_progress') continue;
          for (const t of proj.tasks ?? []) {
            if (t.status === 'in_progress' && t.agent) {
              const n = capitalize(t.agent);
              if (KNOWN_AGENTS.has(n)) map[n] = 'working';
            }
          }
        }
      }
      if (step === 'review-gate' || step === 'audit') {
        for (const proj of directive.projects) {
          for (const r of (proj.reviewers ?? []).map(capitalize)) {
            if (KNOWN_AGENTS.has(r)) map[r] = 'working';
          }
        }
      }
    }
    return map;
  }, [sessions, activeDirectives, KNOWN_AGENTS]);

  // Build agent → task title map from directive pipeline (authoritative source)
  const directiveTaskNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const directive of activeDirectives) {
      const step = directive.currentStepId ?? '';
      // For planning/brainstorm steps, show the directive title for involved agents
      if (['plan', 'brainstorm', 'challenge', 'project-brainstorm'].includes(step)) {
        const label = directive.title ?? directive.directiveName.replace(/-/g, ' ');
        map['Morgan'] = `Planning: ${label}`;
        if (['brainstorm', 'challenge', 'project-brainstorm'].includes(step)) {
          map['Sarah'] = `Reviewing: ${label}`;
        }
      }
      // For execute step, show the in-progress task title per agent
      if (step === 'execute') {
        for (const proj of directive.projects) {
          if (proj.status !== 'in_progress') continue;
          for (const t of proj.tasks ?? []) {
            if (t.status === 'in_progress' && t.agent) {
              const n = capitalize(t.agent);
              if (KNOWN_AGENTS.has(n)) map[n] = t.title;
            }
          }
        }
      }
      if (step === 'review-gate' || step === 'audit') {
        const label = directive.title ?? directive.directiveName.replace(/-/g, ' ');
        for (const proj of directive.projects) {
          for (const r of (proj.reviewers ?? []).map(capitalize)) {
            if (KNOWN_AGENTS.has(r)) map[r] = `Reviewing: ${label}`;
          }
        }
      }
    }
    return map;
  }, [activeDirectives, KNOWN_AGENTS]);

  // Derive per-agent session context info (prefer working session's activity)
  const agentSessionInfos = useMemo<Record<string, SessionInfo>>(() => {
    const map: Record<string, SessionInfo> = {};
    const mapPriority: Record<string, number> = {};
    const latestActivity: Record<string, number> = {};
    const statusPri: Record<string, number> = { working: 3, 'waiting-approval': 2, 'waiting-input': 2 };
    for (const s of sessions) {
      if (s.agentName && KNOWN_AGENTS.has(s.agentName)) {
        // Track most recent activity across all sessions for this agent
        if (s.lastActivity) {
          const ts = new Date(s.lastActivity).getTime();
          if (ts > (latestActivity[s.agentName] ?? 0)) {
            latestActivity[s.agentName] = ts;
          }
        }
        const pri = statusPri[s.status] ?? 0;
        if (pri >= (mapPriority[s.agentName] ?? -1)) {
          mapPriority[s.agentName] = pri;
          const activity = sessionActivities[s.id];
          map[s.agentName] = {
            taskName: directiveTaskNames[s.agentName] ?? s.feature ?? formatSlug(s.slug) ?? extractTaskName(s.initialPrompt) ?? undefined,
            toolName: activity?.tool ?? undefined,
            detail: activity?.detail ?? undefined,
          };
        }
      }
    }
    // Attach lastActivityMs + directive task names for agents without sessions
    for (const name of KNOWN_AGENTS) {
      if (!map[name]) map[name] = {};
      map[name].lastActivityMs = latestActivity[name] ?? undefined;
      // Override with directive task name if available (authoritative)
      if (directiveTaskNames[name]) map[name].taskName = directiveTaskNames[name];
    }
    return map;
  }, [sessions, sessionActivities, directiveTaskNames, KNOWN_AGENTS]);

  // Derive per-agent busy flag
  const agentBusyMap = useMemo<Record<string, boolean>>(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.agentName && KNOWN_AGENTS.has(s.agentName)) {
        const status = toAgentStatus(s.status);
        if (status === 'working') {
          counts[s.agentName] = (counts[s.agentName] ?? 0) + 1;
        }
      }
    }
    const map: Record<string, boolean> = {};
    for (const name of KNOWN_AGENTS) {
      map[name] = (counts[name] ?? 0) > 1;
    }
    return map;
  }, [sessions, KNOWN_AGENTS]);

  const { agentInteractions, subagentsByParent } = useMemo(() => {
    const pairs: Array<[string, string, InteractionType]> = [];
    const seen = new Set<string>();
    const byParent = new Map<string, string[]>();

    for (const directive of activeDirectives) {
      const step = directive.currentStepId ?? '';

      // Map pipeline step to interaction type
      let interactionType: InteractionType;
      if (step === 'plan' || step === 'project-brainstorm') {
        interactionType = 'planning';
      } else if (step === 'brainstorm' || step === 'challenge') {
        interactionType = 'brainstorming';
      } else if (step === 'execute') {
        interactionType = 'building';
      } else if (step === 'review-gate') {
        interactionType = 'reviewing';
      } else if (step === 'audit') {
        interactionType = 'auditing';
      } else {
        interactionType = 'planning'; // fallback
      }

      // During plan/brainstorm/challenge: gather planners + C-suite into meeting
      if (['plan', 'brainstorm', 'challenge', 'project-brainstorm'].includes(step)) {
        // Collect all agents involved in the directive's active projects
        const meetingAgents = new Set<string>();
        // COO (Morgan) is always in planning meetings
        if (KNOWN_AGENTS.has('Morgan')) meetingAgents.add('Morgan');
        // CTO (Sarah) joins for audit-adjacent steps
        if (['brainstorm', 'challenge', 'project-brainstorm'].includes(step)) {
          if (KNOWN_AGENTS.has('Sarah')) meetingAgents.add('Sarah');
        }
        // Add project agents for project-brainstorm
        if (step === 'project-brainstorm') {
          for (const proj of directive.projects) {
            for (const t of proj.tasks ?? []) {
              if (t.agent) {
                const name = capitalize(t.agent);
                if (KNOWN_AGENTS.has(name)) meetingAgents.add(name);
              }
            }
          }
        }
        // Build meeting group — put all agents as children under the first one
        // The engine checks subIds.length >= MEETING_SUBAGENT_THRESHOLD (3),
        // so we include the host in the children array too (the engine dedupes via Set)
        const agents = Array.from(meetingAgents);
        if (agents.length >= 2) {
          const host = agents[0];
          byParent.set(host, agents);
          // Also create interaction pairs for chat bubbles
          for (let i = 0; i < agents.length; i++) {
            for (let j = i + 1; j < agents.length; j++) {
              const key = [agents[i], agents[j]].sort().join(':');
              if (!seen.has(key)) {
                seen.add(key);
                pairs.push([agents[i], agents[j], interactionType]);
              }
            }
          }
        }
      }

      // During execute: builders who are working get interaction pairs with each other
      if (step === 'execute') {
        const builders = new Set<string>();
        for (const proj of directive.projects) {
          if (proj.status !== 'in_progress') continue;
          for (const t of proj.tasks ?? []) {
            if (t.status === 'in_progress' && t.agent) {
              const name = capitalize(t.agent);
              if (KNOWN_AGENTS.has(name)) builders.add(name);
            }
          }
        }
        // If multiple builders working on same directive, they interact
        const builderList = Array.from(builders);
        for (let i = 0; i < builderList.length; i++) {
          for (let j = i + 1; j < builderList.length; j++) {
            const key = [builderList[i], builderList[j]].sort().join(':');
            if (!seen.has(key)) {
              seen.add(key);
              pairs.push([builderList[i], builderList[j], interactionType]);
            }
          }
        }
      }

      // During review-gate or audit: reviewers + builders interact
      if (step === 'review-gate' || step === 'audit') {
        for (const proj of directive.projects) {
          const reviewers = (proj.reviewers ?? []).map(capitalize).filter(n => KNOWN_AGENTS.has(n));
          const builders = new Set<string>();
          for (const t of proj.tasks ?? []) {
            if (t.agent) {
              const name = capitalize(t.agent);
              if (KNOWN_AGENTS.has(name)) builders.add(name);
            }
          }
          // Each reviewer interacts with each builder
          for (const reviewer of reviewers) {
            for (const builder of builders) {
              if (reviewer === builder) continue;
              const key = [reviewer, builder].sort().join(':');
              if (!seen.has(key)) {
                seen.add(key);
                pairs.push([reviewer, builder, interactionType]);
              }
            }
          }
        }
      }
    }

    return { agentInteractions: pairs, subagentsByParent: byParent };
  }, [activeDirectives, KNOWN_AGENTS]);

  // Derive review interactions from directive state
  // Maps reviewer → builder for "walk to builder's desk" behavior
  const reviewInteractions = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const directive of activeDirectives) {
      const step = directive.currentStepId ?? '';
      if (step !== 'review-gate' && step !== 'audit') continue;
      for (const proj of directive.projects) {
        const reviewers = (proj.reviewers ?? []).map(capitalize).filter(n => KNOWN_AGENTS.has(n));
        // Find the primary builder for each project
        const builders = new Set<string>();
        for (const t of proj.tasks ?? []) {
          if (t.agent) {
            const name = capitalize(t.agent);
            if (KNOWN_AGENTS.has(name)) builders.add(name);
          }
        }
        const primaryBuilder = Array.from(builders)[0];
        if (primaryBuilder) {
          for (const reviewer of reviewers) {
            if (reviewer !== primaryBuilder) {
              map.set(reviewer, primaryBuilder);
            }
          }
        }
      }
    }
    return map;
  }, [activeDirectives, KNOWN_AGENTS]);

  // Handle agent click from canvas
  const handleAgentClick = useCallback((agentName: string) => {
    if (!agentName) {
      setSelected(null);
      setSheetOpen(false);
      return;
    }

    if (selected?.agentName === agentName) {
      setSelected(null);
      setSheetOpen(false);
      return;
    }

    const agent = officeAgentsRef.current.find((a: { agentName: string }) => a.agentName === agentName);
    if (agent) {
      setSelected({
        type: 'desk',
        agentName: agent.agentName,
        position: agent.position,
      });
      setSheetOpen(true);
    }
  }, [selected]);

  const handleClose = useCallback(() => {
    setSelected(null);
    setSheetOpen(false);
  }, []);

  // Wire HUD buttons to SidePanel with toggle behavior
  const handlePanelRequest = useCallback((panel: HudPanel) => {
    const typeMap: Record<HudPanel, TileType> = {
      team: 'hud-team',
      tasks: 'hud-tasks',
      status: 'hud-status',
      log: 'hud-log',
    };
    // Toggle: if same panel already open, close it
    if (selected?.type === typeMap[panel]) {
      setSelected(null);
      setSheetOpen(false);
      return;
    }
    setSelected({ type: typeMap[panel], position: { row: 0, col: 0 } });
    setSheetOpen(true);
  }, [selected]);

  // Handle furniture/desk click from canvas
  const handleItemClick = useCallback((item: ClickedItem | null) => {
    if (!item) {
      setSelected(null);
      setSheetOpen(false);
      return;
    }

    const typeMap: Record<ClickedItem['type'], TileType> = {
      desk: 'desk',
      furniture: 'desk',
      server: 'server-room',
      conference: 'conference',
      wall: 'wall',
      whiteboard: 'whiteboard',
      bookshelf: 'bookshelf',
    };

    let tileType = typeMap[item.type];

    // Route generic 'furniture' clicks by room zone for richer panels
    if (item.type === 'furniture') {
      const zone = getZoneAt(item.col, item.row);
      if (zone === 'ceo-office') tileType = 'ceo-desk';
      else if (zone === 'meeting') tileType = 'conference';
      else if (zone === 'server-room') tileType = 'server-room';
    }

    // If this furniture type maps to a HUD tab, open that tab instead
    const hudPanel = FURNITURE_TAB_MAP[tileType];
    if (hudPanel) {
      handlePanelRequest(hudPanel);
      return;
    }

    setSelected({
      type: tileType,
      agentName: item.agentName,
      position: { row: item.row, col: item.col },
    });
    setSheetOpen(true);
  }, [handlePanelRequest]);

  // Derive which HudPanel is active (for header button highlight)
  const activePanel = useMemo<HudPanel | null>(() => {
    if (!selected) return null;
    switch (selected.type) {
      case 'hud-team': return 'team';
      case 'hud-tasks': return 'tasks';
      case 'hud-action': return 'tasks'; // backward compat
      case 'hud-directive': return 'tasks'; // merged
      case 'hud-status': return 'status';
      case 'hud-log': return 'log';
      default: return null;
    }
  }, [selected]);

  const gameContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={gameContainerRef} className="flex flex-col h-full">
      <GameHeader
        onPanelRequest={handlePanelRequest}
        gameContainerRef={gameContainerRef}
        activePanel={activePanel}
        workingCount={Object.values(agentStatuses).filter((s) => s === 'working').length}
        staffCount={OFFICE_AGENTS.filter((a: { isPlayer: boolean }) => !a.isPlayer).length}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-auto bg-stone-200 dark:bg-stone-950 relative">
          <CanvasOffice
            agents={OFFICE_AGENTS}
            onAgentClick={handleAgentClick}
            onItemClick={handleItemClick}
            agentStatuses={agentStatuses}
            agentSessionInfos={agentSessionInfos}
            agentBusyMap={agentBusyMap}
            agentInteractions={agentInteractions}
            subagentsByParent={subagentsByParent}
            reviewInteractions={reviewInteractions}
            selectedAgentName={selected?.agentName ?? null}
          />
          <AgentTicker agentStatuses={agentStatuses} agentSessionInfos={agentSessionInfos} />
          <ControlsHint />
        </div>

        {/* SidePanel on desktop when something is selected */}
        {!isMobile && selected && (
          <SidePanel
            selected={selected}
            agentStatuses={agentStatuses}
            onClose={handleClose}
            variant="side"
          />
        )}
      </div>

      {isMobile && sheetOpen && selected && (
        <SidePanel
          selected={selected}
          agentStatuses={agentStatuses}
          onClose={handleClose}
          variant="bottom"
        />
      )}

      <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '11px', color: '#666', opacity: 0.7 }}>
        Tileset by <a href="https://limezu.itch.io/modernoffice" target="_blank" rel="noopener" style={{ color: '#888' }}>LimeZu</a>
        {' | '}
        Characters by <a href="https://jik-a-4.itch.io/metrocity-free-topdown-character-pack" target="_blank" rel="noopener" style={{ color: '#888' }}>JIK-A-4</a> (CC0)
      </div>
    </div>
  );
}
