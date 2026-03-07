/**
 * Role definitions and name generation — zero dependencies.
 */

import type { RoleDefinition, AgentEntry, PresetName } from './types.js';

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: 'cto', role: 'Chief Technology Officer', title: 'CTO',
    description: 'Architecture, security, code quality, technology intelligence',
    templateFile: 'cto.md', isCsuite: true, reportsTo: 'ceo',
    domains: ['Architecture', 'Security', 'Code Quality', 'Tech Intelligence'],
    color: 'text-violet-400', bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-500/40', dotColor: 'bg-violet-500',
  },
  {
    id: 'coo', role: 'Chief Operating Officer', title: 'COO',
    description: 'Orchestration, planning, casting, ecosystem intelligence',
    templateFile: 'coo.md', isCsuite: true, reportsTo: 'ceo',
    domains: ['Planning', 'Casting', 'Sequencing', 'Ecosystem Intelligence'],
    color: 'text-emerald-400', bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/40', dotColor: 'bg-emerald-500',
  },
  {
    id: 'cpo', role: 'Chief Product Officer', title: 'CPO',
    description: 'Product strategy, UX, feature prioritization, market intelligence',
    templateFile: 'cpo.md', isCsuite: true, reportsTo: 'ceo',
    domains: ['Product Strategy', 'UX', 'Prioritization', 'Market Intelligence'],
    color: 'text-blue-400', bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/40', dotColor: 'bg-blue-500',
  },
  {
    id: 'cmo', role: 'Chief Marketing Officer', title: 'CMO',
    description: 'Growth, SEO, positioning, growth intelligence',
    templateFile: 'cmo.md', isCsuite: true, reportsTo: 'ceo',
    domains: ['Growth', 'SEO', 'Positioning', 'Growth Intelligence'],
    color: 'text-amber-400', bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/40', dotColor: 'bg-amber-500',
  },
  {
    id: 'frontend', role: 'Frontend Developer', title: 'FE',
    description: 'React, Tailwind, component architecture, UI implementation',
    templateFile: 'frontend.md', isCsuite: false, reportsTo: 'cto',
    domains: ['React', 'Tailwind', 'Components', 'UI'],
    color: 'text-pink-400', bgColor: 'bg-pink-500/15',
    borderColor: 'border-pink-500/40', dotColor: 'bg-pink-500',
  },
  {
    id: 'backend', role: 'Backend Developer', title: 'BE',
    description: 'Server, API, database, infrastructure implementation',
    templateFile: 'backend.md', isCsuite: false, reportsTo: 'cto',
    domains: ['Server', 'API', 'Database', 'Infra'],
    color: 'text-teal-400', bgColor: 'bg-teal-500/15',
    borderColor: 'border-teal-500/40', dotColor: 'bg-teal-500',
  },
  {
    id: 'fullstack', role: 'Full-Stack Engineer', title: 'FS',
    description: 'Cross-domain work spanning frontend and backend',
    templateFile: 'fullstack.md', isCsuite: false, reportsTo: 'cto',
    domains: ['Full-Stack', 'Cross-Domain'],
    color: 'text-indigo-400', bgColor: 'bg-indigo-500/15',
    borderColor: 'border-indigo-500/40', dotColor: 'bg-indigo-500',
  },
  {
    id: 'data', role: 'Data Engineer', title: 'DE',
    description: 'Data pipelines, indexing, state management, parsers',
    templateFile: 'data.md', isCsuite: false, reportsTo: 'cto',
    domains: ['Pipelines', 'Indexing', 'State', 'Parsers'],
    color: 'text-cyan-400', bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/40', dotColor: 'bg-cyan-500',
  },
  {
    id: 'qa', role: 'QA Engineer', title: 'QA',
    description: 'Testing, validation, quality assurance, edge cases',
    templateFile: 'qa.md', isCsuite: false, reportsTo: 'cto',
    domains: ['Testing', 'Validation', 'QA', 'Edge Cases'],
    color: 'text-lime-400', bgColor: 'bg-lime-500/15',
    borderColor: 'border-lime-500/40', dotColor: 'bg-lime-500',
  },
  {
    id: 'design', role: 'UI/UX Designer', title: 'UX',
    description: 'UI design, design review, wireframes, visual consistency, usability',
    templateFile: 'design.md', isCsuite: false, reportsTo: 'cpo',
    domains: ['UI Design', 'UX', 'Wireframes', 'Visual Review'],
    color: 'text-rose-400', bgColor: 'bg-rose-500/15',
    borderColor: 'border-rose-500/40', dotColor: 'bg-rose-500',
  },
  {
    id: 'content', role: 'Content Builder', title: 'CB',
    description: 'MDX, copywriting, SEO content, documentation',
    templateFile: 'content.md', isCsuite: false, reportsTo: 'cmo',
    domains: ['MDX', 'Copywriting', 'SEO Content', 'Docs'],
    color: 'text-orange-400', bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/40', dotColor: 'bg-orange-500',
  },
];

/** Role IDs included in each preset */
export const PRESET_ROLES: Record<PresetName, string[] | null> = {
  starter:  ['coo', 'cto', 'fullstack', 'qa'],           // 4 agents
  standard: ['coo', 'cto', 'cpo', 'frontend', 'backend', 'fullstack', 'qa'], // 7 agents
  full:     null,                                          // all 11
  custom:   null,                                          // user picks
};

/** Minimum required role IDs for any team */
export const REQUIRED_ROLES = ['coo', 'cto'];

const FIRST_NAMES = [
  'Aiden', 'Alex', 'Amara', 'Aria', 'Avery', 'Blake', 'Cameron', 'Carmen',
  'Casey', 'Charlie', 'Clara', 'Dana', 'Devon', 'Elena', 'Elias', 'Emery',
  'Ethan', 'Finley', 'Harper', 'Hayden', 'Iris', 'Jade', 'Jamie', 'Jordan',
  'Kai', 'Kenji', 'Layla', 'Leo', 'Lina', 'Logan', 'Luna', 'Mara', 'Marco',
  'Maya', 'Mika', 'Morgan', 'Nadia', 'Nico', 'Nina', 'Noah', 'Nora', 'Oliver',
  'Priya', 'Quinn', 'Ravi', 'Reese', 'Riley', 'River', 'Robin', 'Rowan',
  'Sage', 'Sam', 'Sara', 'Sasha', 'Skyler', 'Sol', 'Talia', 'Taylor', 'Theo',
  'Valentina', 'Yuki', 'Zara', 'Zion',
];

const LAST_NAMES = [
  'Andersen', 'Bauer', 'Blake', 'Castillo', 'Chen', 'Cohen', 'Cruz', 'Davis',
  'Diaz', 'Ellis', 'Fischer', 'Garcia', 'Goldberg', 'Grant', 'Gupta', 'Hayes',
  'Huang', 'Ibrahim', 'Ishikawa', 'Jensen', 'Kaplan', 'Kim', 'Kumar', 'Laurent',
  'Lee', 'Lin', 'Lopez', 'Malik', 'Morales', 'Muller', 'Nakamura', 'Novak',
  'Okafor', 'Park', 'Patel', 'Perez', 'Quinn', 'Rao', 'Reeves', 'Rivera',
  'Robinson', 'Santos', 'Sato', 'Sharma', 'Silva', 'Singh', 'Tanaka', 'Torres',
  'Volkov', 'Wang', 'Weber', 'Williams', 'Wu', 'Yamamoto', 'Zhang',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUniqueName(usedFirstNames: Set<string>): { first: string; last: string } {
  let first: string;
  let attempts = 0;
  do {
    first = pickRandom(FIRST_NAMES);
    attempts++;
  } while (usedFirstNames.has(first) && attempts < 100);
  usedFirstNames.add(first);
  const last = pickRandom(LAST_NAMES);
  return { first, last };
}

/**
 * Generate AgentEntry objects for the given role IDs with random unique names.
 */
export function generateAgents(roleIds: string[]): AgentEntry[] {
  const usedFirstNames = new Set<string>();
  const agents: AgentEntry[] = [];

  const selectedRoles = ROLE_DEFINITIONS.filter(r => roleIds.includes(r.id));
  for (const roleDef of selectedRoles) {
    const { first, last } = generateUniqueName(usedFirstNames);
    const fullName = `${first} ${last}`;
    const agentFileBase = `${first.toLowerCase()}-${roleDef.id}`;

    agents.push({
      id: first.toLowerCase(),
      name: fullName,
      firstName: first,
      title: roleDef.title,
      role: roleDef.role,
      description: roleDef.description,
      agentFile: `${agentFileBase}.md`,
      reportsTo: roleDef.reportsTo,
      domains: roleDef.domains,
      color: roleDef.color,
      bgColor: roleDef.bgColor,
      borderColor: roleDef.borderColor,
      dotColor: roleDef.dotColor,
      isCsuite: roleDef.isCsuite,
    });
  }

  // Resolve reportsTo from role id to generated agent id
  const roleToId = new Map<string, string>();
  for (let i = 0; i < selectedRoles.length; i++) {
    roleToId.set(selectedRoles[i].id, agents[i].id);
  }
  for (const agent of agents) {
    if (agent.reportsTo && agent.reportsTo !== 'ceo') {
      agent.reportsTo = roleToId.get(agent.reportsTo) ?? agent.reportsTo;
    }
  }

  return agents;
}

/**
 * Get all role IDs (for "full" preset).
 */
export function getAllRoleIds(): string[] {
  return ROLE_DEFINITIONS.map(r => r.id);
}

/**
 * Check if a set of role IDs meets the minimum requirements.
 * Returns an error message string or null if valid.
 */
export function validateRoles(roleIds: string[]): string | null {
  for (const req of REQUIRED_ROLES) {
    if (!roleIds.includes(req)) {
      const def = ROLE_DEFINITIONS.find(r => r.id === req);
      return `Missing required role: ${def?.title ?? req} (${req})`;
    }
  }
  const builders = roleIds.filter(id => {
    const def = ROLE_DEFINITIONS.find(r => r.id === id);
    return def && !def.isCsuite;
  });
  if (builders.length === 0) {
    return 'You need at least 1 builder role (e.g. fullstack, frontend, backend)';
  }
  return null;
}
