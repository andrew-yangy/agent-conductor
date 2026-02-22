import fs from 'node:fs';
import path from 'node:path';
import type { Team, TeamMember } from '../types.js';

interface RawMember {
  agentId?: string;
  name?: string;
  agentType?: string;
  model?: string;
  joinedAt?: number | string;
  tmuxPaneId?: string;
  cwd?: string;
  color?: string;
  isActive?: boolean;
  backendType?: string;
  // Intentionally skip 'prompt' — it's huge
}

interface RawTeamConfig {
  name?: string;
  description?: string;
  createdAt?: number | string;
  leadAgentId?: string;
  leadSessionId?: string;
  members?: RawMember[];
}

function parseTimestamp(raw: number | string | undefined): string {
  if (typeof raw === 'number') return new Date(raw).toISOString();
  if (typeof raw === 'string') return raw;
  return new Date().toISOString();
}

function parseMember(raw: RawMember): TeamMember {
  return {
    name: raw.name ?? 'unnamed',
    agentId: raw.agentId ?? '',
    agentType: raw.agentType ?? 'unknown',
    model: raw.model ?? '',
    tmuxPaneId: raw.tmuxPaneId ?? '',
    cwd: raw.cwd ?? '',
    color: raw.color ?? '',
    isActive: raw.isActive ?? false,
    backendType: raw.backendType ?? '',
    joinedAt: parseTimestamp(raw.joinedAt),
  };
}

export function parseTeamConfig(filePath: string): Team | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = JSON.parse(content) as RawTeamConfig;

    const members: TeamMember[] = (raw.members ?? []).map(parseMember);

    return {
      name: raw.name ?? path.basename(path.dirname(filePath)),
      description: raw.description ?? '',
      members,
      createdAt: parseTimestamp(raw.createdAt),
      leadAgentId: raw.leadAgentId ?? '',
      leadSessionId: raw.leadSessionId ?? '',
      stale: false,
    };
  } catch (err) {
    console.error(`[team-parser] Error parsing ${filePath}:`, err);
    return null;
  }
}

export function parseAllTeams(claudeHome: string): Team[] {
  const teamsDir = path.join(claudeHome, 'teams');
  const teams: Team[] = [];

  try {
    if (!fs.existsSync(teamsDir)) return [];

    const entries = fs.readdirSync(teamsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const configPath = path.join(teamsDir, entry.name, 'config.json');
      const team = parseTeamConfig(configPath);
      if (team) {
        teams.push(team);
      }
    }
  } catch (err) {
    console.error(`[team-parser] Error scanning teams directory:`, err);
  }

  return teams;
}
