/**
 * gruai update — Update framework files to latest version.
 *
 * Strategy: backup-and-overwrite.
 *  - Backs up existing skill files and CLAUDE.md to .gruai-backup/{timestamp}/
 *  - Overwrites skills and re-renders CLAUDE.md with latest template
 *  - Preserves: .context/ (user data), agent-registry.json (team names), agents/*.md, gruai.config.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { c } from '../lib/color.js';
import { TEMPLATES_DIR, SKILLS_SRC_DIR } from '../lib/paths.js';
const ALL_SKILLS = ['directive', 'scout', 'healthcheck', 'report'];
function printUpdateHelp() {
    console.log(`
${c.bold('gruai update')} — Update framework files to the latest version

${c.bold('Usage:')}
  gru-ai update [options]

${c.bold('Options:')}
  --path <path>  Project path (default: current directory)
  --help         Show this help message

${c.bold('Strategy:')} backup-and-overwrite
  - Backs up existing framework files to .gruai-backup/{timestamp}/
  - Overwrites skill files and CLAUDE.md with latest versions
  - Does NOT overwrite .context/ (your data) or agent-registry.json (your team)

${c.bold('Examples:')}
  gru-ai update
  gru-ai update --path ./my-project
`);
}
function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}
function copyFile(src, dest) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}
function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else {
            copyFile(srcPath, destPath);
        }
    }
}
function backupPath(filePath, projectPath, backupDir) {
    if (!fs.existsSync(filePath))
        return;
    const relativePath = path.relative(projectPath, filePath);
    const backupTarget = path.join(backupDir, relativePath);
    if (fs.statSync(filePath).isDirectory()) {
        copyDirRecursive(filePath, backupTarget);
    }
    else {
        copyFile(filePath, backupTarget);
    }
}
function readExistingAgents(projectPath) {
    // Try .gruai/ first, then .claude/ for backwards compatibility
    const paths = [
        path.join(projectPath, '.gruai', 'agent-registry.json'),
        path.join(projectPath, '.claude', 'agent-registry.json'),
    ];
    for (const registryPath of paths) {
        try {
            const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
            return data.agents
                .filter(a => a.id !== 'ceo')
                .map(a => ({ name: a.name, title: a.title, role: a.role }));
        }
        catch {
            // try next
        }
    }
    return [];
}
function readProjectName(projectPath) {
    const configPath = path.join(projectPath, 'gruai.config.json');
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.name)
            return config.name;
    }
    catch {
        // fall through
    }
    const claudePath = path.join(projectPath, 'CLAUDE.md');
    try {
        const content = fs.readFileSync(claudePath, 'utf-8');
        const match = content.match(/^# (.+?) — Claude Code Rules/m);
        if (match?.[1])
            return match[1];
    }
    catch {
        // fall through
    }
    return 'My Project';
}
export async function runUpdate(flags) {
    if (flags['help']) {
        printUpdateHelp();
        process.exit(0);
    }
    const projectPath = typeof flags['path'] === 'string'
        ? path.resolve(flags['path'])
        : process.cwd();
    // Verify this is a gruai project
    const hasGruai = fs.existsSync(path.join(projectPath, '.gruai'));
    const hasRegistry = fs.existsSync(path.join(projectPath, '.claude', 'agent-registry.json'));
    const hasConfig = fs.existsSync(path.join(projectPath, 'gruai.config.json'));
    if (!hasGruai && !hasRegistry && !hasConfig) {
        console.error(c.red('  Error: This does not appear to be a gruai project.'));
        console.error(`  Run ${c.cyan("'gru-ai init'")} first to scaffold the framework.`);
        process.exit(1);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(projectPath, '.gruai-backup', timestamp);
    console.log(`\n  ${c.bold('gruai update')} ${c.dim('-- backup-and-overwrite')}\n`);
    console.log(`  ${c.dim('Backup dir:')} ${backupDir}\n`);
    let backedUp = 0;
    let updated = 0;
    // Determine where skills live (.gruai/ or .claude/)
    const skillsBase = hasGruai
        ? path.join(projectPath, '.gruai', 'skills')
        : path.join(projectPath, '.claude', 'skills');
    // 1. Back up and update skill files
    for (const skill of ALL_SKILLS) {
        const destSkillDir = path.join(skillsBase, skill);
        const srcSkillDir = path.join(SKILLS_SRC_DIR, skill);
        const srcSkillMd = path.join(srcSkillDir, 'SKILL.md');
        if (!fs.existsSync(srcSkillMd))
            continue;
        if (fs.existsSync(destSkillDir)) {
            backupPath(destSkillDir, projectPath, backupDir);
            backedUp++;
        }
        copyFile(srcSkillMd, path.join(destSkillDir, 'SKILL.md'));
        const docsDir = path.join(srcSkillDir, 'docs');
        if (fs.existsSync(docsDir) && fs.statSync(docsDir).isDirectory()) {
            copyDirRecursive(docsDir, path.join(destSkillDir, 'docs'));
        }
        updated++;
    }
    console.log(c.green(`  [+] Skills:    ${updated} updated`));
    // 2. Back up and re-render CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
        backupPath(claudeMdPath, projectPath, backupDir);
        backedUp++;
    }
    const projectName = readProjectName(projectPath);
    const agents = readExistingAgents(projectPath);
    const templatePath = path.join(TEMPLATES_DIR, 'CLAUDE.md.template');
    if (fs.existsSync(templatePath) && agents.length > 0) {
        const template = fs.readFileSync(templatePath, 'utf-8');
        const rosterLines = ['| Name | Title | Role |', '|------|-------|------|'];
        rosterLines.push('| (You) | CEO | Chief Executive Officer |');
        for (const agent of agents) {
            rosterLines.push(`| ${agent.name} | ${agent.title} | ${agent.role} |`);
        }
        const content = template
            .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
            .replace(/\{\{AGENT_ROSTER\}\}/g, rosterLines.join('\n'));
        fs.writeFileSync(claudeMdPath, content, 'utf-8');
        updated++;
        console.log(c.green(`  [+] CLAUDE.md: re-rendered with latest template`));
    }
    else {
        console.log(c.yellow(`  [-] CLAUDE.md: skipped (no template or no agents found)`));
    }
    // 3. Report preserved items
    console.log(`\n  ${c.bold('Preserved')} (not overwritten):`);
    console.log(c.dim(`    .context/                    (your data)`));
    console.log(c.dim(`    agent-registry.json           (your team names)`));
    console.log(c.dim(`    agents/*.md                   (your personality files)`));
    console.log(c.dim(`    gruai.config.json             (your configuration)`));
    console.log(`\n  ${c.bold('Summary:')} ${c.green(`${updated} updated`)}, ${c.cyan(`${backedUp} backed up`)}`);
    console.log(`  ${c.dim('Backup location:')} ${backupDir}\n`);
}
