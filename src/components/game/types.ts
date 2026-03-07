// ---------------------------------------------------------------------------
// Game Types -- Office Simulation
// ---------------------------------------------------------------------------

import type { AgentRegistry } from '@/stores/agent-registry-store';
import registryJson from '../../../.claude/agent-registry.json';

/** Agent status derived from session data */
export type AgentStatus = 'working' | 'idle';

/** Interaction type derived from directive pipeline step */
export type InteractionType = 'planning' | 'brainstorming' | 'building' | 'reviewing' | 'auditing';

/** Tile type strings (kept for SidePanel compatibility) */
export type TileType =
  | 'floor'
  | 'wall'
  | 'desk'
  | 'ceo-desk'
  | 'conference'
  | 'whiteboard'
  | 'mailbox'
  | 'bell'
  | 'server-room'
  | 'door'
  | 'bookshelf'
  | 'hud-team'
  | 'hud-tasks'
  | 'hud-action'
  | 'hud-ops'
  | 'hud-directive'
  | 'hud-log';

/** Currently selected item (kept for SidePanel compatibility) */
export interface SelectedItem {
  type: TileType;
  agentName?: string;
  position: { row: number; col: number };
}

/** Agent definition for game presence */
export interface AgentDesk {
  id: number;
  agentName: string;
  agentRole: string;
  palette: number;
  hueShift: number;
  seatId: string;
  position: { row: number; col: number };
  color: string;
  /** True for the CEO / player-controlled character */
  isPlayer: boolean;
}

/**
 * Build OFFICE_AGENTS from a runtime-loaded agent registry.
 * Returns only agents that have a `game` config (non-null).
 * Gracefully handles partial registries (4, 7, 12 agents).
 */
export function buildOfficeAgents(registry: AgentRegistry | null): AgentDesk[] {
  if (!registry || !Array.isArray(registry.agents)) return [];
  return registry.agents
    .filter((a) => a.game != null)
    .map((a, idx) => ({
      id: idx + 1,
      agentName: a.name.split(' ')[0],
      agentRole: a.title,
      palette: a.game!.palette,
      hueShift: a.game!.hueShift ?? 0,
      seatId: a.game!.seatId,
      position: { row: a.game!.position.row, col: a.game!.position.col },
      color: a.game!.color,
      isPlayer: !!a.game!.isPlayer,
    }));
}

/**
 * Build the agent char map from office agents.
 * Maps grid character code to agent name (kept for compat).
 */
export function buildAgentCharMap(agents: AgentDesk[]): Record<string, string> {
  return Object.fromEntries(
    agents.map((a) => {
      // Use first letter, except Marcus -> 'X' to avoid collision with Morgan's 'M'
      const char = a.agentName === 'Marcus' ? 'X' : a.agentName[0];
      return [char, a.agentName];
    })
  );
}

/** Static OFFICE_AGENTS built from the local agent-registry.json at build time */
export const OFFICE_AGENTS: AgentDesk[] = buildOfficeAgents(registryJson as AgentRegistry);

/** Interactive tile types the user can click (kept for compat) */
export const INTERACTIVE_TILES: Set<TileType> = new Set([
  'desk',
  'ceo-desk',
  'conference',
  'whiteboard',
  'mailbox',
  'bell',
  'server-room',
  'door',
]);
