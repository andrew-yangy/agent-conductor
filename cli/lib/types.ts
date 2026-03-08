/**
 * CLI types — shared across commands.
 */

export type Platform = 'claude-code' | 'aider' | 'gemini-cli' | 'codex' | 'other';

export type PresetName = 'starter' | 'standard' | 'full' | 'custom';

export interface AgentGameConfig {
  palette: number;
  hueShift?: number;
  seatId: string;
  position: { row: number; col: number };
  color: string;
  isPlayer?: boolean;
}

export interface AgentEntry {
  id: string;
  name: string;
  firstName: string;
  title: string;
  role: string;
  description: string;
  agentFile: string;
  reportsTo: string;
  domains: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  isCsuite: boolean;
  game: AgentGameConfig | null;
}

export interface InitConfig {
  projectName: string;
  projectPath: string;
  preset: PresetName;
  agents: AgentEntry[];
  platform: Platform;
}

export interface RoleDefinition {
  id: string;
  role: string;
  title: string;
  description: string;
  templateFile: string;
  isCsuite: boolean;
  reportsTo: string;
  domains: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}
