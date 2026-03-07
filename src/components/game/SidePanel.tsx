// ---------------------------------------------------------------------------
// SidePanel — shell with tab strip and panel routing
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Users, Zap, Activity, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type AgentStatus, type SelectedItem } from './types';
import { useBadgeCounts, type BadgeCounts } from './hooks/useBadgeCounts';
import {
  TeamPanel,
  ActionPanel,
  StatusPanel,
  LogPanel,
  AgentPanel,
  CeoDeskPanel,
  WhiteboardPanel,
  MailboxPanel,
  ConferencePanel,
  BellPanel,
  ServerRoomPanel,
  BookshelfPanel,
  PARCHMENT,
} from './panels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidePanelProps {
  selected: SelectedItem | null;
  agentStatuses: Record<string, AgentStatus>;
  onClose: () => void;
  /** 'side' = fixed right column (desktop), 'bottom' = overlay sheet (mobile) */
  variant?: 'side' | 'bottom';
}

type HudTab = 'team' | 'tasks' | 'status' | 'log';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HUD_TYPES = new Set(['hud-team', 'hud-tasks', 'hud-status', 'hud-log']);

const TAB_ICONS: Record<HudTab, React.ReactNode> = {
  team: <Users className="h-3 w-3" />,
  tasks: <Zap className="h-3 w-3" />,
  status: <Activity className="h-3 w-3" />,
  log: <ScrollText className="h-3 w-3" />,
};

const TAB_LIST: { id: HudTab; label: string }[] = [
  { id: 'team', label: 'Team' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'status', label: 'Status' },
  { id: 'log', label: 'Log' },
];

function hudTypeToTab(type: string): HudTab | null {
  switch (type) {
    case 'hud-team': return 'team';
    case 'hud-tasks': return 'tasks';
    case 'hud-action': return 'tasks'; // backward compat
    case 'hud-directive': return 'tasks'; // merged into tasks
    case 'hud-status': return 'status';
    case 'hud-log': return 'log';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Panel title
// ---------------------------------------------------------------------------

function panelTitle(selected: SelectedItem | null, activeTab: HudTab | null): string {
  // If showing a HUD tab, use the tab name
  if (activeTab) {
    const tab = TAB_LIST.find((t) => t.id === activeTab);
    return tab?.label ?? 'Office';
  }
  if (!selected) return 'Office Overview';
  switch (selected.type) {
    case 'desk':          return selected.agentName ?? 'Agent Desk';
    case 'ceo-desk':      return 'CEO Desk';
    case 'conference':    return 'Conference Room';
    case 'whiteboard':    return 'Whiteboard';
    case 'mailbox':       return 'Mailbox';
    case 'bell':          return 'Scout Bell';
    case 'server-room':   return 'Server Room';
    case 'bookshelf':     return 'Knowledge Base';
    case 'door':          return 'Entrance';
    default:              return 'Office';
  }
}

// ---------------------------------------------------------------------------
// Tab strip component
// ---------------------------------------------------------------------------

function TabStrip({
  activeTab,
  onTabChange,
  badges,
}: {
  activeTab: HudTab;
  onTabChange: (tab: HudTab) => void;
  badges: BadgeCounts;
}) {
  return (
    <div
      className="flex font-mono text-[11px]"
      style={{
        backgroundColor: '#D4B896',
        borderBottom: `2px solid ${PARCHMENT.border}`,
        boxShadow: 'inset 0 -1px 0 0 #A08040',
      }}
      role="tablist"
      aria-label="Panel tabs"
    >
      {TAB_LIST.map((tab) => {
        const isActive = tab.id === activeTab;
        const count = badges[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 px-2 py-2 transition-all select-none relative',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500',
            )}
            style={{
              color: isActive ? '#2A1A0E' : '#6B4C3B',
              fontWeight: isActive ? 700 : 500,
              backgroundColor: isActive ? PARCHMENT.bg : 'transparent',
              borderBottom: isActive ? `2px solid ${PARCHMENT.bg}` : '2px solid transparent',
              marginBottom: isActive ? '-2px' : '-2px',
              ...(isActive ? {
                boxShadow: `inset 0 2px 0 0 ${PARCHMENT.border}, -1px 0 0 0 ${PARCHMENT.border}, 1px 0 0 0 ${PARCHMENT.border}`,
              } : {}),
            }}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="flex items-center" style={{ opacity: isActive ? 1 : 0.6 }}>
              {TAB_ICONS[tab.id]}
            </span>
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className="ml-0.5 min-w-[14px] text-center px-0.5 text-[9px] font-bold leading-[14px]"
                style={{
                  backgroundColor: '#B83A2A',
                  color: '#fff',
                  borderRadius: '2px',
                  boxShadow: 'inset -1px -1px 0 0 #8A2010, inset 1px 1px 0 0 #D05040',
                  imageRendering: 'pixelated',
                }}
                aria-label={`${count} notification${count !== 1 ? 's' : ''}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel content renderer
// ---------------------------------------------------------------------------

function PanelContent({
  selected,
  agentStatuses,
  activeTab,
  agentOverride,
  onSelectAgent,
}: {
  selected: SelectedItem | null;
  agentStatuses: Record<string, AgentStatus>;
  activeTab: HudTab | null;
  agentOverride: string | null;
  onSelectAgent: (name: string) => void;
}) {
  // If an agent was selected from team panel, show agent detail
  if (agentOverride) {
    return <AgentPanel agentName={agentOverride} agentStatuses={agentStatuses} />;
  }

  // If a tab is active, render the tab panel
  if (activeTab) {
    switch (activeTab) {
      case 'team':
        return <TeamPanel agentStatuses={agentStatuses} onSelectAgent={onSelectAgent} />;
      case 'tasks':
        return <ActionPanel />;
      case 'status':
        return <StatusPanel />;
      case 'log':
        return <LogPanel />;
    }
  }

  // Otherwise, render based on selected item type
  if (!selected) return <TeamPanel agentStatuses={agentStatuses} onSelectAgent={onSelectAgent} />;

  switch (selected.type) {
    case 'desk':
      return selected.agentName
        ? <AgentPanel agentName={selected.agentName} agentStatuses={agentStatuses} />
        : <p className="text-sm font-mono" style={{ color: PARCHMENT.text }}>Empty desk</p>;
    case 'ceo-desk':      return <CeoDeskPanel />;
    case 'whiteboard':    return <WhiteboardPanel />;
    case 'mailbox':       return <MailboxPanel />;
    case 'conference':    return <ConferencePanel />;
    case 'bell':          return <BellPanel />;
    case 'server-room':   return <ServerRoomPanel />;
    case 'bookshelf':     return <BookshelfPanel />;
    case 'door':
      return <p className="text-sm font-mono" style={{ color: PARCHMENT.text }}>The office entrance.</p>;
    default:
      return <TeamPanel agentStatuses={agentStatuses} onSelectAgent={onSelectAgent} />;
  }
}

// ---------------------------------------------------------------------------
// SidePanel
// ---------------------------------------------------------------------------

export default function SidePanel({ selected, agentStatuses, onClose, variant = 'side' }: SidePanelProps) {
  // Badge counts for tab notifications
  const badges = useBadgeCounts();

  // Determine if we should show the tab strip (HUD panel mode)
  const isHudMode = selected ? HUD_TYPES.has(selected.type) : false;

  // Active tab state — synced from selected.type when it's a HUD type
  const [activeTab, setActiveTab] = useState<HudTab | null>(null);

  // Agent override: when clicking an agent in TeamPanel, temporarily show their detail
  const [agentOverride, setAgentOverride] = useState<string | null>(null);

  // Sync activeTab from selected prop
  useEffect(() => {
    if (selected && HUD_TYPES.has(selected.type)) {
      const tab = hudTypeToTab(selected.type);
      setActiveTab(tab);
      setAgentOverride(null); // Reset agent override on tab change
    } else {
      setActiveTab(null);
      setAgentOverride(null);
    }
  }, [selected]);

  const handleTabChange = useCallback((tab: HudTab) => {
    setActiveTab(tab);
    setAgentOverride(null);
  }, []);

  const handleSelectAgent = useCallback((agentName: string) => {
    setAgentOverride(agentName);
  }, []);

  // Back button handler for agent override
  const handleBackFromAgent = useCallback(() => {
    setAgentOverride(null);
  }, []);

  // Escape key dismisses bottom sheet
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (variant !== 'bottom') return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [variant, handleKeyDown]);

  const title = agentOverride
    ? agentOverride
    : panelTitle(selected, activeTab);

  // Parchment panel styles
  const panelStyle = {
    backgroundColor: PARCHMENT.bg,
    color: PARCHMENT.text,
  };

  // Wood header style (matches GameHeader)
  const headerStyle = {
    backgroundColor: '#5C3D2E',
    color: '#F5ECD7',
    borderBottom: `2px solid #3D2B1F`,
    boxShadow: 'inset 0 1px 0 0 #6B4C3B',
  };

  // -- Side variant (desktop) -----------------------------------------------
  if (variant === 'side') {
    return (
      <aside
        className="w-80 xl:w-96 flex flex-col shrink-0"
        style={{
          ...panelStyle,
          borderLeft: `2px solid #3D2B1F`,
        }}
      >
        {/* Header — wood theme */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={headerStyle}
        >
          <div className="flex items-center gap-2 min-w-0">
            {agentOverride && (
              <button
                type="button"
                className="h-6 px-1.5 text-[11px] font-mono shrink-0 rounded transition-colors"
                style={{ color: '#C4A265' }}
                onClick={handleBackFromAgent}
                aria-label="Back to tab"
              >
                &#9664; Back
              </button>
            )}
            <h2
              className="text-sm font-bold font-mono truncate"
              style={{ color: '#C4A265', textShadow: '0 1px 2px #3D2B1F' }}
            >
              {title}
            </h2>
          </div>
          {selected && (
            <button
              type="button"
              className="h-6 w-6 shrink-0 flex items-center justify-center rounded transition-colors hover:bg-white/10"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="h-3.5 w-3.5" style={{ color: '#C4A265' }} />
            </button>
          )}
        </div>

        {/* Content — with subtle inner frame */}
        <ScrollArea className="flex-1">
          <div
            className="p-3"
            style={{
              margin: '6px',
              borderRadius: '2px',
              boxShadow: 'inset 1px 1px 0 0 #C4A26540, inset -1px -1px 0 0 #F5ECD740',
              backgroundColor: '#F0E4C8',
            }}
          >
            <PanelContent
              selected={selected}
              agentStatuses={agentStatuses}
              activeTab={isHudMode ? activeTab : null}
              agentOverride={agentOverride}
              onSelectAgent={handleSelectAgent}
            />
          </div>
        </ScrollArea>
      </aside>
    );
  }

  // -- Bottom sheet variant (mobile) ----------------------------------------
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl max-h-[55vh] flex flex-col animate-[slideUp_200ms_ease-out]"
        style={{
          ...panelStyle,
          borderTop: `2px solid ${PARCHMENT.border}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1" style={{ backgroundColor: '#5C3D2E' }}>
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#C4A265' }} />
        </div>

        {/* Header — wood theme */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={headerStyle}
        >
          <div className="flex items-center gap-2 min-w-0">
            {agentOverride && (
              <button
                type="button"
                className="h-6 px-1.5 text-[11px] font-mono shrink-0 rounded"
                style={{ color: '#C4A265' }}
                onClick={handleBackFromAgent}
                aria-label="Back to tab"
              >
                &#9664; Back
              </button>
            )}
            <h2
              id="sheet-title"
              className="text-sm font-bold font-mono truncate"
              style={{ color: '#C4A265', textShadow: '0 1px 2px #3D2B1F' }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="h-6 w-6 shrink-0 flex items-center justify-center rounded hover:bg-white/10"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-3.5 w-3.5" style={{ color: '#C4A265' }} />
          </button>
        </div>

        {/* Content — with subtle inner frame */}
        <ScrollArea className="flex-1 min-h-0">
          <div
            className="p-3"
            style={{
              margin: '6px',
              borderRadius: '2px',
              boxShadow: 'inset 1px 1px 0 0 #C4A26540, inset -1px -1px 0 0 #F5ECD740',
              backgroundColor: '#F0E4C8',
            }}
          >
            <PanelContent
              selected={selected}
              agentStatuses={agentStatuses}
              activeTab={isHudMode ? activeTab : null}
              agentOverride={agentOverride}
              onSelectAgent={handleSelectAgent}
            />
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
