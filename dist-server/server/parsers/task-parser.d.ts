import type { TeamTask } from '../types.js';
/**
 * Parse all task directories, returning UUID-named (session) dirs only.
 */
export declare function parseAllTasks(claudeHome: string, _knownTeamNames: Set<string>): {
    bySession: Record<string, TeamTask[]>;
};
