// ---------------------------------------------------------------------------
// useOfficeAgents — derives OFFICE_AGENTS from the runtime agent registry store
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { useAgentRegistryStore } from '@/stores/agent-registry-store';
import { buildOfficeAgents, type AgentDesk } from './types';

/**
 * Hook that returns the current OFFICE_AGENTS array derived from the
 * runtime-loaded agent registry. Returns an empty array while loading.
 *
 * Memoized so the array reference is stable across re-renders when the
 * registry hasn't changed.
 */
export function useOfficeAgents(): AgentDesk[] {
  const registry = useAgentRegistryStore((s) => s.registry);
  return useMemo(() => buildOfficeAgents(registry), [registry]);
}
