/**
 * gruai init — Interactive project setup.
 *
 * Prompts: project name, team size preset, agent name customization, platform selection.
 * Then delegates to scaffold.ts to create all files.
 *
 * Uses ONLY Node readline — no external dependencies.
 */

import * as readline from 'node:readline';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { c } from '../lib/color.js';
import {
  ROLE_DEFINITIONS,
  PRESET_ROLES,
  REQUIRED_ROLES,
  generateAgents,
  getAllRoleIds,
  validateRoles,
} from '../lib/roles.js';
import type { InitConfig, Platform, PresetName, AgentEntry } from '../lib/types.js';
import { runScaffold } from './scaffold.js';

// ─── Readline helpers ────────────────────────────────────────────────────────

function createRL(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function printInitHelp(): void {
  console.log(`
${c.bold('gruai init')} — Scaffold the gruai framework into a project

${c.bold('Usage:')}
  gru-ai init [options]

${c.bold('Options:')}
  --name <name>      Project name (skip prompt)
  --path <path>      Project path (default: current directory)
  --preset <preset>  Team preset: starter, standard, full (skip prompt)
  --yes              Skip confirmations
  --help             Show this help message

${c.bold('Examples:')}
  gru-ai init
  gru-ai init --name "My Project" --preset standard
  gru-ai init --name "My App" --yes
`);
}

// ─── Prompt stages ───────────────────────────────────────────────────────────

async function promptProjectName(rl: readline.Interface, flags: Record<string, string | boolean>): Promise<string> {
  if (typeof flags['name'] === 'string') return flags['name'];

  const defaultName = path.basename(process.cwd());
  const answer = await ask(rl, `  ${c.bold('Project name')} ${c.dim(`(${defaultName})`)}: `);
  return answer || defaultName;
}

async function promptPreset(rl: readline.Interface, flags: Record<string, string | boolean>): Promise<PresetName> {
  if (typeof flags['preset'] === 'string') {
    const p = flags['preset'] as PresetName;
    if (['starter', 'standard', 'full', 'custom'].includes(p)) return p;
    console.error(c.red(`  Invalid preset: ${flags['preset']}. Must be starter, standard, full, or custom.`));
  }
  // Default to standard when --yes is passed
  if (flags['yes']) return 'standard';

  console.log(`
  ${c.bold('Team size presets:')}

    ${c.cyan('1)')} Starter   ${c.dim('(4 agents:  COO, CTO, Full-Stack, QA)')}
    ${c.cyan('2)')} Standard  ${c.dim('(7 agents:  + CPO, Frontend, Backend)')}
    ${c.cyan('3)')} Full      ${c.dim('(11 agents: all roles including CMO, Design, Data, Content)')}
    ${c.cyan('4)')} Custom    ${c.dim('(pick your own roles)')}
`);

  const presetMap: Record<string, PresetName> = { '1': 'starter', '2': 'standard', '3': 'full', '4': 'custom' };

  while (true) {
    const answer = await ask(rl, `  ${c.bold('Choose a preset')} ${c.dim('(1-4, default 2)')}: `);
    const choice = answer || '2';
    if (presetMap[choice]) return presetMap[choice];
    if (['starter', 'standard', 'full', 'custom'].includes(choice)) return choice as PresetName;
    console.log(c.red('  Please enter 1, 2, 3, or 4.'));
  }
}

async function promptCustomRoles(rl: readline.Interface): Promise<string[]> {
  console.log(`
  ${c.bold('Available roles:')} ${c.dim('(COO and CTO are required, plus at least 1 builder)')}`);

  const builderRoles = ROLE_DEFINITIONS.filter(r => !r.isCsuite);
  const csuiteRoles = ROLE_DEFINITIONS.filter(r => r.isCsuite);

  console.log(`\n  ${c.dim('C-suite (leadership):')}`);
  for (const r of csuiteRoles) {
    const required = REQUIRED_ROLES.includes(r.id);
    const tag = required ? c.green(' [required]') : '';
    console.log(`    ${r.id.padEnd(10)} ${r.title.padEnd(4)} ${r.role}${tag}`);
  }

  console.log(`\n  ${c.dim('Builders (engineering & creative):')}`);
  for (const r of builderRoles) {
    console.log(`    ${r.id.padEnd(10)} ${r.title.padEnd(4)} ${r.role}`);
  }

  while (true) {
    const answer = await ask(rl, `\n  ${c.bold('Enter role IDs')} ${c.dim('(comma-separated, e.g. coo,cto,fullstack,qa)')}: `);
    const roleIds = answer.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const error = validateRoles(roleIds);
    if (error) {
      console.log(c.red(`  ${error}`));
      continue;
    }

    // Validate all IDs exist
    const unknowns = roleIds.filter(id => !ROLE_DEFINITIONS.find(r => r.id === id));
    if (unknowns.length > 0) {
      console.log(c.red(`  Unknown roles: ${unknowns.join(', ')}`));
      continue;
    }

    return roleIds;
  }
}

async function promptAgentNames(
  rl: readline.Interface,
  agents: AgentEntry[],
  flags: Record<string, string | boolean>,
): Promise<AgentEntry[]> {
  if (flags['yes']) return agents;

  console.log(`\n  ${c.bold('Your team:')} ${c.dim('(press Enter to keep the generated name)')}\n`);

  for (const agent of agents) {
    const prompt = `    ${agent.title.padEnd(4)} ${c.dim(agent.role.padEnd(28))} [${c.cyan(agent.name)}]: `;
    const answer = await ask(rl, prompt);
    if (answer) {
      const parts = answer.split(' ');
      agent.firstName = parts[0];
      agent.name = answer;
      agent.id = parts[0].toLowerCase();
      agent.agentFile = `${parts[0].toLowerCase()}-${ROLE_DEFINITIONS.find(r => r.title === agent.title)?.id ?? 'agent'}.md`;
    }
  }

  return agents;
}

async function promptPlatform(rl: readline.Interface, flags: Record<string, string | boolean>): Promise<Platform> {
  if (typeof flags['platform'] === 'string') {
    const valid: Platform[] = ['claude-code', 'aider', 'gemini-cli', 'codex', 'other'];
    if (valid.includes(flags['platform'] as Platform)) return flags['platform'] as Platform;
  }
  // Default to claude-code when --yes is passed
  if (flags['yes']) return 'claude-code';

  console.log(`
  ${c.bold('Platform:')} ${c.dim('(determines where agent config files are placed)')}

    ${c.cyan('1)')} Claude Code   ${c.dim('.claude/ directory')}
    ${c.cyan('2)')} Aider         ${c.dim('.aider/ directory')}
    ${c.cyan('3)')} Gemini CLI    ${c.dim('.gemini/ directory')}
    ${c.cyan('4)')} Codex         ${c.dim('.codex/ directory')}
    ${c.cyan('5)')} Other         ${c.dim('.gruai/ only')}
`);

  const platformMap: Record<string, Platform> = {
    '1': 'claude-code', '2': 'aider', '3': 'gemini-cli', '4': 'codex', '5': 'other',
  };

  while (true) {
    const answer = await ask(rl, `  ${c.bold('Choose a platform')} ${c.dim('(1-5, default 1)')}: `);
    const choice = answer || '1';
    if (platformMap[choice]) return platformMap[choice];
    console.log(c.red('  Please enter 1, 2, 3, 4, or 5.'));
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function runInit(flags: Record<string, string | boolean>): Promise<void> {
  if (flags['help']) {
    printInitHelp();
    process.exit(0);
  }

  const projectPath = typeof flags['path'] === 'string'
    ? path.resolve(flags['path'])
    : process.cwd();

  // Check for existing project
  const gruaiDir = path.join(projectPath, '.gruai');
  const configFile = path.join(projectPath, 'gruai.config.json');
  if (fs.existsSync(gruaiDir) || fs.existsSync(configFile)) {
    const rl = createRL();
    try {
      console.log(c.yellow('\n  Warning: This project appears to already be initialized.'));
      console.log(c.dim('  Existing files may be overwritten.\n'));
      const answer = await ask(rl, `  ${c.bold('Continue anyway?')} ${c.dim('(y/N)')}: `);
      if (answer.toLowerCase() !== 'y') {
        console.log('  Cancelled.');
        process.exit(0);
      }
    } finally {
      rl.close();
    }
  }

  const rl = createRL();
  try {
    console.log(`\n  ${c.bold('gruai')} ${c.dim('-- Project Setup')}\n`);

    // Stage 1: Project name
    const projectName = await promptProjectName(rl, flags);

    // Stage 2: Team preset
    const preset = await promptPreset(rl, flags);

    // Stage 3: Resolve role IDs based on preset
    let roleIds: string[];
    if (preset === 'custom') {
      roleIds = await promptCustomRoles(rl);
    } else if (preset === 'full') {
      roleIds = getAllRoleIds();
    } else {
      roleIds = PRESET_ROLES[preset]!;
    }

    // Generate agents with random names
    let agents = generateAgents(roleIds);

    // Stage 4: Agent name customization
    agents = await promptAgentNames(rl, agents, flags);

    // Stage 5: Platform selection
    const platform = await promptPlatform(rl, flags);

    // Build config
    const config: InitConfig = {
      projectName,
      projectPath,
      preset,
      agents,
      platform,
    };

    // Confirm
    if (!flags['yes']) {
      console.log(`\n  ${c.bold('Configuration:')}`);
      console.log(`    Project:  ${c.cyan(config.projectName)}`);
      console.log(`    Path:     ${c.dim(config.projectPath)}`);
      console.log(`    Preset:   ${config.preset} (${config.agents.length} agents + CEO)`);
      console.log(`    Platform: ${config.platform}`);

      const confirm = await ask(rl, `\n  ${c.bold('Proceed?')} ${c.dim('(Y/n)')}: `);
      if (confirm.toLowerCase() === 'n') {
        console.log('  Cancelled.');
        process.exit(0);
      }
    }

    rl.close();

    // Scaffold
    await runScaffold(config);
  } catch (err) {
    rl.close();
    throw err;
  }
}
