/**
 * Static configuration for the conductor's named agents.
 * This defines the org hierarchy, display properties, and team groupings.
 */

export interface AgentConfig {
  id: string;
  name: string;
  title: string;
  role: string;
  description: string;
  reportsTo: string | null;
  domains: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  /** Whether this agent is a C-suite executive (vs specialist builder) */
  isCsuite: boolean;
}

export interface TeamConfig {
  id: string;
  name: string;
  description: string;
  leadAgentId: string;
  memberAgentIds: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

// ---------------------------------------------------------------------------
// C-Suite Agents
// ---------------------------------------------------------------------------

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'sarah',
    name: 'Sarah Chen',
    title: 'CTO',
    role: 'Chief Technology Officer',
    description: 'Architecture, security, code quality, technology intelligence',
    reportsTo: 'ceo',
    domains: ['Architecture', 'Security', 'Code Quality', 'Tech Intelligence'],
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-500/40',
    dotColor: 'bg-violet-500',
    isCsuite: true,
  },
  {
    id: 'marcus',
    name: 'Marcus Rivera',
    title: 'CPO',
    role: 'Chief Product Officer',
    description: 'Product strategy, UX, feature prioritization, market intelligence',
    reportsTo: 'ceo',
    domains: ['Product Strategy', 'UX', 'Prioritization', 'Market Intelligence'],
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/40',
    dotColor: 'bg-blue-500',
    isCsuite: true,
  },
  {
    id: 'morgan',
    name: 'Morgan Park',
    title: 'COO',
    role: 'Chief Operating Officer',
    description: 'Orchestration, planning, casting, ecosystem intelligence',
    reportsTo: 'ceo',
    domains: ['Planning', 'Casting', 'Sequencing', 'Ecosystem Intelligence'],
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40',
    dotColor: 'bg-emerald-500',
    isCsuite: true,
  },
  {
    id: 'priya',
    name: 'Priya Sharma',
    title: 'CMO',
    role: 'Chief Marketing Officer',
    description: 'Growth, SEO, positioning, growth intelligence',
    reportsTo: 'ceo',
    domains: ['Growth', 'SEO', 'Positioning', 'Growth Intelligence'],
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40',
    dotColor: 'bg-amber-500',
    isCsuite: true,
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    title: 'CoS',
    role: 'Chief of Staff',
    description: 'Execution, delegation, CEO summaries, directive orchestration',
    reportsTo: 'ceo',
    domains: ['Execution', 'Delegation', 'Reporting'],
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-500/40',
    dotColor: 'bg-sky-500',
    isCsuite: true,
  },

  // -------------------------------------------------------------------------
  // Specialist Agents (builders — display-only for now)
  // -------------------------------------------------------------------------
  {
    id: 'riley',
    name: 'Riley Kim',
    title: 'FE',
    role: 'Frontend Developer',
    description: 'React, Tailwind, component architecture, UI implementation',
    reportsTo: 'sarah',
    domains: ['React', 'Tailwind', 'Components', 'UI'],
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
    borderColor: 'border-pink-500/40',
    dotColor: 'bg-pink-500',
    isCsuite: false,
  },
  {
    id: 'jordan',
    name: 'Jordan Okafor',
    title: 'BE',
    role: 'Backend Developer',
    description: 'Server, API, database, infrastructure implementation',
    reportsTo: 'sarah',
    domains: ['Server', 'API', 'Database', 'Infra'],
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/15',
    borderColor: 'border-teal-500/40',
    dotColor: 'bg-teal-500',
    isCsuite: false,
  },
  {
    id: 'casey',
    name: 'Casey Liu',
    title: 'DE',
    role: 'Data Engineer',
    description: 'Data pipelines, indexing, state management, parsers',
    reportsTo: 'sarah',
    domains: ['Pipelines', 'Indexing', 'State', 'Parsers'],
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/40',
    dotColor: 'bg-cyan-500',
    isCsuite: false,
  },
  {
    id: 'taylor',
    name: 'Taylor Reeves',
    title: 'CB',
    role: 'Content Builder',
    description: 'MDX, copywriting, SEO content, documentation',
    reportsTo: 'priya',
    domains: ['MDX', 'Copywriting', 'SEO Content', 'Docs'],
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/40',
    dotColor: 'bg-orange-500',
    isCsuite: false,
  },
  {
    id: 'sam',
    name: 'Sam Nakamura',
    title: 'QA',
    role: 'QA Engineer',
    description: 'Testing, validation, quality assurance, edge cases',
    reportsTo: 'sarah',
    domains: ['Testing', 'Validation', 'QA', 'Edge Cases'],
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/15',
    borderColor: 'border-lime-500/40',
    dotColor: 'bg-lime-500',
    isCsuite: false,
  },
];

// ---------------------------------------------------------------------------
// Team Definitions (display-only — cosmetic groupings, not operational)
// ---------------------------------------------------------------------------

export const TEAM_CONFIGS: TeamConfig[] = [
  {
    id: 'platform',
    name: 'Platform',
    description: 'Infrastructure, backend services, data pipelines',
    leadAgentId: 'sarah',
    memberAgentIds: ['sarah', 'jordan', 'casey'],
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
  },
  {
    id: 'product',
    name: 'Product',
    description: 'Frontend, UX, quality assurance',
    leadAgentId: 'marcus',
    memberAgentIds: ['marcus', 'riley', 'sam'],
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Content, SEO, marketing, positioning',
    leadAgentId: 'priya',
    memberAgentIds: ['priya', 'taylor'],
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Planning, orchestration, execution',
    leadAgentId: 'morgan',
    memberAgentIds: ['morgan', 'alex'],
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
];

export const CEO_CONFIG: AgentConfig = {
  id: 'ceo',
  name: 'CEO',
  title: 'CEO',
  role: 'Chief Executive Officer',
  description: 'Sets direction, reviews proposals, approves work',
  reportsTo: null,
  domains: ['Strategy', 'Direction', 'Approval'],
  color: 'text-foreground',
  bgColor: 'bg-foreground/10',
  borderColor: 'border-foreground/30',
  dotColor: 'bg-foreground',
  isCsuite: true,
};

export function getAgentConfig(name: string): AgentConfig | undefined {
  return AGENT_CONFIGS.find(a => a.id === name.toLowerCase());
}

export function getTeamConfig(teamId: string): TeamConfig | undefined {
  return TEAM_CONFIGS.find(t => t.id === teamId);
}

/** Get all agents that belong to a team */
export function getTeamMembers(teamId: string): AgentConfig[] {
  const team = getTeamConfig(teamId);
  if (!team) return [];
  return team.memberAgentIds
    .map(id => getAgentConfig(id))
    .filter((a): a is AgentConfig => a !== undefined);
}
