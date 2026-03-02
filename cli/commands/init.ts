import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to the CLI source (works with tsx and compiled)
const CLI_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..');
const TEMPLATES_DIR = path.join(CLI_ROOT, 'templates');

const ALL_AGENTS = ['sarah-cto', 'morgan-coo', 'marcus-cpo', 'priya-cmo', 'alex-cos'] as const;
const ALL_SKILLS = ['directive', 'scout', 'healthcheck', 'report'] as const;

interface InitConfig {
  projectName: string;
  projectPath: string;
  agents: string[];
  dailyBudget: number;
}

function printInitHelp(): void {
  console.log(`
agent-conductor init — Scaffold the conductor framework into a project

Usage:
  agent-conductor init [options]

Options:
  --name <name>      Project name (prompted if omitted)
  --path <path>      Project path (default: current directory)
  --agents <list>    Comma-separated agent list (default: all)
                     Available: ${ALL_AGENTS.join(', ')}
  --budget <amount>  Daily budget ceiling in USD (default: 50)
  --yes              Skip confirmations
  --help             Show this help message

Examples:
  agent-conductor init
  agent-conductor init --name "My Project" --path ./my-project
  agent-conductor init --agents sarah-cto,morgan-coo --budget 30
`);
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function promptConfig(flags: Record<string, string | boolean>): Promise<InitConfig> {
  // If all required flags are provided, skip interactive mode
  if (flags.name && flags.path) {
    const agentStr = typeof flags.agents === 'string' ? flags.agents : '';
    const agents = agentStr ? agentStr.split(',').map((a) => a.trim()) : [...ALL_AGENTS];
    const budget = typeof flags.budget === 'string' ? parseInt(flags.budget, 10) : 50;

    return {
      projectName: flags.name as string,
      projectPath: path.resolve(flags.path as string),
      agents,
      dailyBudget: isNaN(budget) ? 50 : budget,
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('\n  Agent Conductor — Project Setup\n');

    const projectName =
      typeof flags.name === 'string'
        ? flags.name
        : await ask(rl, `  Project name: `);

    const rawPath =
      typeof flags.path === 'string'
        ? flags.path
        : await ask(rl, `  Project path (default: .): `);
    const projectPath = path.resolve(rawPath || '.');

    console.log(`\n  Available agents: ${ALL_AGENTS.join(', ')}`);
    const agentInput =
      typeof flags.agents === 'string'
        ? flags.agents
        : await ask(rl, `  Agents to enable (default: all): `);
    const agents = agentInput
      ? agentInput.split(',').map((a) => a.trim())
      : [...ALL_AGENTS];

    const budgetInput =
      typeof flags.budget === 'string'
        ? flags.budget
        : await ask(rl, `  Daily budget ceiling in USD (default: 50): `);
    const dailyBudget = budgetInput ? parseInt(budgetInput, 10) : 50;

    if (!flags.yes) {
      console.log(`\n  Configuration:`);
      console.log(`    Name:    ${projectName}`);
      console.log(`    Path:    ${projectPath}`);
      console.log(`    Agents:  ${agents.join(', ')}`);
      console.log(`    Budget:  $${isNaN(dailyBudget) ? 50 : dailyBudget}/day`);
      const confirm = await ask(rl, `\n  Proceed? (Y/n): `);
      if (confirm.toLowerCase() === 'n') {
        console.log('  Cancelled.');
        process.exit(0);
      }
    }

    return {
      projectName,
      projectPath,
      agents,
      dailyBudget: isNaN(dailyBudget) ? 50 : dailyBudget,
    };
  } finally {
    rl.close();
  }
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function scaffoldAgents(projectPath: string, agents: string[]): number {
  const agentsDir = path.join(REPO_ROOT, '.claude', 'agents');
  const destDir = path.join(projectPath, '.claude', 'agents');
  let count = 0;

  for (const agent of agents) {
    const src = path.join(agentsDir, `${agent}.md`);
    if (!fs.existsSync(src)) {
      console.warn(`  Warning: Agent file not found: ${agent}.md (skipped)`);
      continue;
    }
    copyFile(src, path.join(destDir, `${agent}.md`));
    count++;
  }

  return count;
}

function scaffoldSkills(projectPath: string): number {
  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  const destDir = path.join(projectPath, '.claude', 'skills');
  let count = 0;

  for (const skill of ALL_SKILLS) {
    const src = path.join(skillsDir, skill, 'SKILL.md');
    if (!fs.existsSync(src)) {
      console.warn(`  Warning: Skill file not found: ${skill}/SKILL.md (skipped)`);
      continue;
    }
    copyFile(src, path.join(destDir, skill, 'SKILL.md'));
    count++;
  }

  return count;
}

function scaffoldContext(projectPath: string, config: InitConfig): void {
  const contextDir = path.join(projectPath, '.context');

  // Vision template
  const visionTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'vision.md'), 'utf-8');
  const vision = visionTemplate.replace(/\{\{PROJECT_NAME\}\}/g, config.projectName);
  writeFile(path.join(contextDir, 'vision.md'), vision);

  // Goals index template
  const goalsTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'goals-index.md'), 'utf-8');
  const goals = goalsTemplate.replace(/\{\{PROJECT_NAME\}\}/g, config.projectName);
  writeFile(path.join(contextDir, 'goals', '_index.md'), goals);

  // Conductor context
  const lessonsTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'lessons.md'), 'utf-8');
  const lessons = lessonsTemplate.replace(/\{\{PROJECT_NAME\}\}/g, config.projectName);
  writeFile(path.join(contextDir, 'conductor', 'lessons.md'), lessons);

  // Empty directories with .gitkeep
  const emptyDirs = [
    path.join(contextDir, 'conductor', 'inbox'),
    path.join(contextDir, 'conductor', 'done'),
    path.join(contextDir, 'conductor', 'reports'),
  ];

  for (const dir of emptyDirs) {
    ensureDir(dir);
    const gitkeep = path.join(dir, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      fs.writeFileSync(gitkeep, '', 'utf-8');
    }
  }

  // Preferences template
  writeFile(
    path.join(contextDir, 'preferences.md'),
    `# CEO Preferences\n\n> Standing orders for the conductor team. Agents read this before every task.\n\n## Standing Orders\n\n- (Add your preferences here)\n`
  );
}

function configureGlobal(config: InitConfig): void {
  const conductorDir = path.join(process.env.HOME || '~', '.conductor');
  ensureDir(conductorDir);

  // Project config
  const configPath = path.join(conductorDir, 'config.json');
  let existingConfig: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      // Corrupted config, start fresh
    }
  }

  const projects = (existingConfig.projects as Array<Record<string, unknown>>) || [];
  const existing = projects.find((p) => p.path === config.projectPath);
  if (!existing) {
    projects.push({
      name: config.projectName,
      path: config.projectPath,
      agents: config.agents,
      createdAt: new Date().toISOString(),
    });
  }

  writeFile(
    configPath,
    JSON.stringify({ ...existingConfig, projects }, null, 2)
  );

  // Scheduler defaults
  const schedulerPath = path.join(conductorDir, 'scheduler.json');
  if (!fs.existsSync(schedulerPath)) {
    writeFile(
      schedulerPath,
      JSON.stringify(
        {
          dailyBudget: config.dailyBudget,
          schedule: {
            scout: { frequency: 'weekly', day: 'monday', time: '08:00' },
            report: { frequency: 'daily', time: '18:00' },
            healthcheck: { frequency: 'biweekly', day: 'friday', time: '10:00' },
          },
        },
        null,
        2
      )
    );
  }
}

export async function runInit(flags: Record<string, string | boolean>): Promise<void> {
  if (flags.help) {
    printInitHelp();
    process.exit(0);
  }

  const config = await promptConfig(flags);

  // Validate project path
  if (!fs.existsSync(config.projectPath)) {
    console.error(`  Error: Project path does not exist: ${config.projectPath}`);
    process.exit(1);
  }

  // Validate agents
  const invalidAgents = config.agents.filter(
    (a) => !ALL_AGENTS.includes(a as (typeof ALL_AGENTS)[number])
  );
  if (invalidAgents.length > 0) {
    console.error(`  Error: Unknown agents: ${invalidAgents.join(', ')}`);
    console.error(`  Available: ${ALL_AGENTS.join(', ')}`);
    process.exit(1);
  }

  console.log('\n  Scaffolding agent-conductor...\n');

  // 1. Copy agent personality files
  const agentCount = scaffoldAgents(config.projectPath, config.agents);
  console.log(`  [+] Agents:  ${agentCount} personality files`);

  // 2. Copy skill files
  const skillCount = scaffoldSkills(config.projectPath);
  console.log(`  [+] Skills:  ${skillCount} skill definitions`);

  // 3. Scaffold context tree
  scaffoldContext(config.projectPath, config);
  console.log(`  [+] Context: vision.md, goals/_index.md, conductor/`);

  // 4. Configure global settings
  configureGlobal(config);
  console.log(`  [+] Config:  ~/.conductor/config.json`);
  console.log(`  [+] Config:  ~/.conductor/scheduler.json`);

  // 5. Output MCP config instructions
  console.log(`
  Done! Agent Conductor scaffolded into: ${config.projectPath}

  Next steps:

  1. Edit your project vision:
     ${path.join(config.projectPath, '.context', 'vision.md')}

  2. Add your first goal:
     mkdir -p ${path.join(config.projectPath, '.context', 'goals', 'my-goal')}
     Create goal.md and backlog.md inside it.

  3. (Optional) Add the MCP server to ~/.claude/settings.json:

     "agent-conductor": {
       "command": "npx",
       "args": ["tsx", "${path.join(REPO_ROOT, 'mcp-server', 'index.ts')}"],
       "env": {
         "PROJECT_ROOT": "${config.projectPath}"
       }
     }

  4. Create your first directive:
     Write a markdown file in ${path.join(config.projectPath, '.context', 'conductor', 'inbox')}
     Then run: claude -p "/directive my-directive-name"

  Happy orchestrating!
`);
}
