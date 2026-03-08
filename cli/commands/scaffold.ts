/**
 * Scaffolding engine — creates all project files from templates.
 *
 * Takes an InitConfig and produces:
 *  - .gruai/ canonical home directory
 *  - Platform symlink (.claude/, .aider/, etc.)
 *  - .context/ tree (vision, lessons, preferences, backlog, directives, reports)
 *  - Agent personality files for selected roles
 *  - agent-registry.json for selected preset
 *  - CLAUDE.md
 *  - gruai.config.json
 *  - Welcome directive
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { c } from '../lib/color.js';
import { TEMPLATES_DIR, ROLE_TEMPLATES_DIR, SKILLS_SRC_DIR } from '../lib/paths.js';
import { ROLE_DEFINITIONS } from '../lib/roles.js';
import type { InitConfig, AgentEntry, Platform } from '../lib/types.js';

const ALL_SKILLS = ['directive', 'scout', 'healthcheck', 'report'];

// ─── File helpers ────────────────────────────────────────────────────────────

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function readTemplate(name: string): string {
  const filePath = path.join(TEMPLATES_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Platform directory mapping ──────────────────────────────────────────────

function platformDir(platform: Platform): string | null {
  switch (platform) {
    case 'claude-code': return '.claude';
    case 'aider':       return '.aider';
    case 'gemini-cli':  return '.gemini';
    case 'codex':       return '.codex';
    case 'other':       return null;
  }
}

// ─── Scaffold functions ──────────────────────────────────────────────────────

function scaffoldGruaiHome(projectPath: string, platform: Platform): void {
  const gruaiDir = path.join(projectPath, '.gruai');
  ensureDir(gruaiDir);

  // Create platform symlink if applicable
  const platDir = platformDir(platform);
  if (platDir) {
    const platPath = path.join(projectPath, platDir);
    // If platform dir already exists as a real directory, skip symlink
    if (fs.existsSync(platPath)) {
      const stat = fs.lstatSync(platPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(platPath);
      } else {
        // Real directory exists -- copy contents into .gruai and replace with symlink
        const entries = fs.readdirSync(platPath);
        for (const entry of entries) {
          const src = path.join(platPath, entry);
          const dest = path.join(gruaiDir, entry);
          if (!fs.existsSync(dest)) {
            fs.renameSync(src, dest);
          }
        }
        fs.rmSync(platPath, { recursive: true, force: true });
      }
    }
    // Create symlink: .claude -> .gruai
    fs.symlinkSync('.gruai', platPath);
  }
}

function scaffoldAgents(projectPath: string, agents: AgentEntry[]): number {
  const destDir = path.join(projectPath, '.gruai', 'agents');
  let count = 0;

  for (const agent of agents) {
    const roleId = ROLE_DEFINITIONS.find(r => r.title === agent.title)?.id;
    const templatePath = path.join(ROLE_TEMPLATES_DIR, `${roleId}.md`);

    let content: string;
    if (fs.existsSync(templatePath)) {
      content = fs.readFileSync(templatePath, 'utf-8');
      content = content.replace(/\{\{NAME\}\}/g, agent.name);
      content = content.replace(/\{\{FIRST_NAME\}\}/g, agent.firstName);
      content = content.replace(/\{\{FIRST_NAME_LOWER\}\}/g, agent.firstName.toLowerCase());
    } else {
      content = `# ${agent.name} -- ${agent.role}\n\nRole template not found.\n`;
    }

    writeFile(path.join(destDir, agent.agentFile), content);
    count++;
  }

  return count;
}

function scaffoldRegistry(projectPath: string, agents: AgentEntry[], preset: string): void {
  const ceoEntry = {
    id: 'ceo',
    name: 'CEO',
    title: 'CEO',
    role: 'Chief Executive Officer',
    description: 'Sets direction, reviews proposals, approves work',
    agentFile: null,
    reportsTo: null,
    domains: ['Strategy', 'Direction', 'Approval'],
    color: 'text-foreground',
    bgColor: 'bg-foreground/10',
    borderColor: 'border-foreground/30',
    dotColor: 'bg-foreground',
    isCsuite: true,
    game: { palette: 0, seatId: 'seat-1', position: { row: 3, col: 5 }, color: 'gold', isPlayer: true },
  };

  const agentEntries = agents.map(a => ({
    id: a.id,
    name: a.name,
    title: a.title,
    role: a.role,
    description: a.description,
    agentFile: a.agentFile,
    reportsTo: a.reportsTo,
    domains: a.domains,
    color: a.color,
    bgColor: a.bgColor,
    borderColor: a.borderColor,
    dotColor: a.dotColor,
    isCsuite: a.isCsuite,
    game: a.game,
  }));

  const teams = buildTeams(agents);
  const registry = { teamSize: preset, agents: [ceoEntry, ...agentEntries], teams };
  writeFile(path.join(projectPath, '.gruai', 'agent-registry.json'), JSON.stringify(registry, null, 2));
}

function buildTeams(agents: AgentEntry[]): object[] {
  const ctoAgent = agents.find(a => a.title === 'CTO');
  const cpoAgent = agents.find(a => a.title === 'CPO');
  const cmoAgent = agents.find(a => a.title === 'CMO');
  const cooAgent = agents.find(a => a.title === 'COO');

  const teams: object[] = [];

  if (ctoAgent) {
    const members = agents
      .filter(a => a.reportsTo === ctoAgent.id || a.id === ctoAgent.id)
      .map(a => a.id);
    teams.push({
      id: 'engineering', name: 'Engineering',
      description: 'Architecture, backend, data, full-stack engineering',
      leadAgentId: ctoAgent.id, memberAgentIds: members,
      color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/30',
    });
  }

  if (cpoAgent) {
    const members = agents
      .filter(a => a.reportsTo === cpoAgent.id || a.id === cpoAgent.id)
      .map(a => a.id);
    teams.push({
      id: 'product', name: 'Product',
      description: 'Frontend, UX, quality assurance',
      leadAgentId: cpoAgent.id, memberAgentIds: members,
      color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30',
    });
  }

  if (cmoAgent) {
    const members = agents
      .filter(a => a.reportsTo === cmoAgent.id || a.id === cmoAgent.id)
      .map(a => a.id);
    teams.push({
      id: 'growth', name: 'Growth',
      description: 'Content, SEO, marketing, positioning',
      leadAgentId: cmoAgent.id, memberAgentIds: members,
      color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30',
    });
  }

  if (cooAgent) {
    teams.push({
      id: 'operations', name: 'Operations',
      description: 'Planning, orchestration, execution',
      leadAgentId: cooAgent.id, memberAgentIds: [cooAgent.id],
      color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30',
    });
  }

  return teams;
}

function scaffoldSkills(projectPath: string): number {
  const destDir = path.join(projectPath, '.gruai', 'skills');
  let count = 0;

  for (const skill of ALL_SKILLS) {
    const skillDir = path.join(SKILLS_SRC_DIR, skill);
    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      console.warn(c.yellow(`  Warning: Skill file not found: ${skill}/SKILL.md (skipped)`));
      continue;
    }

    copyFile(skillMd, path.join(destDir, skill, 'SKILL.md'));

    const docsDir = path.join(skillDir, 'docs');
    if (fs.existsSync(docsDir) && fs.statSync(docsDir).isDirectory()) {
      copyDirRecursive(docsDir, path.join(destDir, skill, 'docs'));
    }
    count++;
  }

  return count;
}

function scaffoldContext(projectPath: string, config: InitConfig): void {
  const contextDir = path.join(projectPath, '.context');

  // vision.md
  const vision = readTemplate('vision.md').replace(/\{\{PROJECT_NAME\}\}/g, config.projectName);
  writeFile(path.join(contextDir, 'vision.md'), vision);

  // lessons/index.md
  const lessons = readTemplate('lessons.md').replace(/\{\{PROJECT_NAME\}\}/g, config.projectName);
  writeFile(path.join(contextDir, 'lessons', 'index.md'), lessons);

  // preferences.md
  writeFile(
    path.join(contextDir, 'preferences.md'),
    `# CEO Preferences\n\n> Standing orders for the team. Agents read this before every task.\n\n## Standing Orders\n\n- (Add your preferences here)\n`,
  );

  // backlog.json
  const backlog = readTemplate('backlog.json.template');
  writeFile(path.join(contextDir, 'backlog.json'), backlog);

  // Empty directories with .gitkeep
  for (const dir of ['directives', 'reports']) {
    const dirPath = path.join(contextDir, dir);
    ensureDir(dirPath);
    const gitkeep = path.join(dirPath, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      fs.writeFileSync(gitkeep, '', 'utf-8');
    }
  }
}

function scaffoldClaudeMd(projectPath: string, config: InitConfig): void {
  const template = readTemplate('CLAUDE.md.template');

  const rosterLines = ['| Name | Title | Role |', '|------|-------|------|'];
  rosterLines.push('| (You) | CEO | Chief Executive Officer |');
  for (const agent of config.agents) {
    rosterLines.push(`| ${agent.name} | ${agent.title} | ${agent.role} |`);
  }

  const content = template
    .replace(/\{\{PROJECT_NAME\}\}/g, config.projectName)
    .replace(/\{\{AGENT_ROSTER\}\}/g, rosterLines.join('\n'));

  writeFile(path.join(projectPath, 'CLAUDE.md'), content);
}

function scaffoldGruaiConfig(projectPath: string, config: InitConfig): void {
  const template = readTemplate('gruai.config.json.template');
  const agentsJson = JSON.stringify(
    config.agents.map(a => ({ id: a.id, name: a.name, role: a.title })),
    null, 4,
  );
  const indentedAgentsJson = agentsJson
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n');

  const content = template
    .replace(/\{\{PROJECT_NAME\}\}/g, config.projectName)
    .replace(/\{\{PRESET\}\}/g, config.preset)
    .replace(/\{\{PLATFORM\}\}/g, config.platform)
    .replace(/\{\{AGENTS_JSON\}\}/g, indentedAgentsJson);

  writeFile(path.join(projectPath, 'gruai.config.json'), content);
}

function scaffoldWelcomeDirective(projectPath: string): void {
  const srcDir = path.join(TEMPLATES_DIR, 'welcome-directive');
  if (!fs.existsSync(srcDir)) return;

  const destDir = path.join(projectPath, '.context', 'directives', 'welcome');
  ensureDir(destDir);

  // directive.json
  const djson = fs.readFileSync(path.join(srcDir, 'directive.json'), 'utf-8');
  writeFile(
    path.join(destDir, 'directive.json'),
    djson.replace(/\{\{CREATED_AT\}\}/g, new Date().toISOString()),
  );

  // directive.md
  copyFile(path.join(srcDir, 'directive.md'), path.join(destDir, 'directive.md'));
}

// ─── Main scaffold function ─────────────────────────────────────────────────

export async function runScaffold(config: InitConfig): Promise<void> {
  if (!fs.existsSync(config.projectPath)) {
    console.error(c.red(`  Error: Project path does not exist: ${config.projectPath}`));
    process.exit(1);
  }

  console.log(`\n  ${c.bold('Scaffolding gruai...')}\n`);

  // 1. .gruai/ home + platform symlink
  scaffoldGruaiHome(config.projectPath, config.platform);
  const platDir = platformDir(config.platform);
  if (platDir) {
    console.log(c.green(`  [+] Home:        .gruai/ with ${platDir}/ -> .gruai/ symlink`));
  } else {
    console.log(c.green(`  [+] Home:        .gruai/`));
  }

  // 2. Agent registry
  scaffoldRegistry(config.projectPath, config.agents, config.preset);
  console.log(c.green(`  [+] Registry:    .gruai/agent-registry.json (${config.agents.length} agents + CEO, ${config.preset} preset)`));

  // 3. Agent personality files
  const agentCount = scaffoldAgents(config.projectPath, config.agents);
  console.log(c.green(`  [+] Agents:      ${agentCount} personality files`));

  // 4. Skills
  const skillCount = scaffoldSkills(config.projectPath);
  console.log(c.green(`  [+] Skills:      ${skillCount} skill definitions`));

  // 5. Context tree
  scaffoldContext(config.projectPath, config);
  console.log(c.green(`  [+] Context:     vision.md, lessons/, directives/, backlog.json`));

  // 6. CLAUDE.md
  scaffoldClaudeMd(config.projectPath, config);
  console.log(c.green(`  [+] CLAUDE.md:   project rules with agent roster`));

  // 7. gruai.config.json
  scaffoldGruaiConfig(config.projectPath, config);
  console.log(c.green(`  [+] Config:      gruai.config.json`));

  // 8. Welcome directive
  scaffoldWelcomeDirective(config.projectPath);
  console.log(c.green(`  [+] Directive:   welcome directive scaffolded`));

  // Output team summary
  console.log(`\n  ${c.bold('Done!')} gruai scaffolded into: ${c.cyan(config.projectPath)}\n`);
  console.log(`  ${c.bold('Your team:')}\n`);
  for (const agent of config.agents) {
    const csuite = agent.isCsuite ? c.dim(' (C-suite)') : '';
    console.log(`    ${agent.name.padEnd(22)} ${c.cyan(agent.title.padEnd(5))} ${agent.role}${csuite}`);
  }

  console.log(`
  ${c.bold('Next steps:')}

  1. Edit your project vision:
     ${c.dim(path.join(config.projectPath, '.context', 'vision.md'))}

  2. Set your preferences (standing orders for the team):
     ${c.dim(path.join(config.projectPath, '.context', 'preferences.md'))}

  3. Start the dashboard:
     ${c.cyan('gru-ai start')}

  4. Create your first directive:
     ${c.cyan('claude -p "/directive welcome"')}

  ${c.dim('Happy orchestrating!')}
`);
}
