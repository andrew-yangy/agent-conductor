import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Agent Registry Types (mirrors the shape of agent-registry.json)
// ---------------------------------------------------------------------------

export interface AgentGameConfig {
  palette: number;
  hueShift?: number;
  seatId: string;
  position: { row: number; col: number };
  color: string;
  isPlayer?: boolean;
}

export interface AgentRegistryEntry {
  id: string;
  name: string;
  title: string;
  role: string;
  description: string;
  agentFile: string | null;
  reportsTo: string | null;
  domains: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  isCsuite: boolean;
  game: AgentGameConfig | null;
}

export interface AgentRegistry {
  agents: AgentRegistryEntry[];
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface AgentRegistryStore {
  registry: AgentRegistry | null;
  loading: boolean;
  error: string | null;
  fetchRegistry: () => Promise<void>;
}

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:4444'
  : '';

export const useAgentRegistryStore = create<AgentRegistryStore>((set, get) => ({
  registry: null,
  loading: false,
  error: null,

  fetchRegistry: async () => {
    // Avoid duplicate fetches
    if (get().registry || get().loading) return;

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/agent-registry`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AgentRegistry;
      set({ registry: data, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[agent-registry] Failed to fetch:', msg);
      // Fall back to empty registry so the game still renders
      set({ registry: { agents: [] }, loading: false, error: msg });
    }
  },
}));
