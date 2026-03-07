/**
 * validate-init.ts -- Zero-trust verification of gruai init scaffolding
 *
 * Exercises:
 * 1. Run scaffold programmatically into temp directories
 * 2. Verify agent-registry.json schema
 * 3. Verify agent personality files exist with content
 * 4. Verify skill directories with SKILL.md
 * 5. Verify .context/ tree
 * 6. Verify CLAUDE.md agent roster table
 *
 * Run: npx tsx scripts/validate-init.ts
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generateAgents, PRESET_ROLES, getAllRoleIds } from '../cli/lib/roles.js';
import { runScaffold } from '../cli/commands/scaffold.js';
import type { InitConfig } from '../cli/lib/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

function fileNonEmpty(p: string): boolean {
  try {
    const stat = fs.statSync(p);
    return stat.size > 0;
  } catch { return false; }
}

async function validateScaffold(presetName: string, roleIds: string[]): Promise<void> {
  console.log(`\n=== Scaffolding preset: ${presetName} (${roleIds.length} roles) ===`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `gruai-init-${presetName}-`));

  try {
    const agents = generateAgents(roleIds);

    const config: InitConfig = {
      projectName: `Test Project (${presetName})`,
      projectPath: tmpDir,
      preset: presetName as any,
      agents,
      platform: 'claude-code',
    };

    await runScaffold(config);

    // --- 1. agent-registry.json ---
    console.log('\n  --- agent-registry.json ---');
    const registryPath = path.join(tmpDir, '.gruai', 'agent-registry.json');
    assert(fileExists(registryPath), 'agent-registry.json exists');

    if (fileExists(registryPath)) {
      const raw = fs.readFileSync(registryPath, 'utf-8');
      let registry: any;
      try {
        registry = JSON.parse(raw);
        assert(true, 'agent-registry.json is valid JSON');
      } catch (e) {
        assert(false, `agent-registry.json is valid JSON: ${e}`);
        return;
      }

      assert(Array.isArray(registry.agents), 'registry.agents is an array');
      // Should have CEO + all generated agents
      assert(registry.agents.length === agents.length + 1, `registry has ${agents.length + 1} agents (including CEO): got ${registry.agents.length}`);
      assert(registry.teamSize === presetName, `registry.teamSize is "${presetName}"`);

      // Each agent has required fields
      for (const agent of registry.agents) {
        const hasFields = agent.id && agent.name && agent.role;
        if (!hasFields) {
          assert(false, `Agent ${agent.id ?? 'unknown'} missing required fields`);
        }
      }
      assert(true, 'All agents have id, name, role fields');

      // Teams array exists
      assert(Array.isArray(registry.teams), 'registry.teams is an array');
    }

    // --- 2. Agent personality files ---
    console.log('\n  --- Agent personality files ---');
    const agentsDir = path.join(tmpDir, '.gruai', 'agents');
    assert(fileExists(agentsDir), '.gruai/agents/ directory exists');

    for (const agent of agents) {
      const agentPath = path.join(agentsDir, agent.agentFile);
      assert(fileExists(agentPath), `${agent.agentFile} exists`);
      assert(fileNonEmpty(agentPath), `${agent.agentFile} has content`);
    }

    // --- 3. Skill directories ---
    console.log('\n  --- Skill directories ---');
    const expectedSkills = ['directive', 'scout', 'healthcheck', 'report'];
    for (const skill of expectedSkills) {
      const skillMd = path.join(tmpDir, '.gruai', 'skills', skill, 'SKILL.md');
      assert(fileExists(skillMd), `${skill}/SKILL.md exists`);
      assert(fileNonEmpty(skillMd), `${skill}/SKILL.md has content`);
    }

    // --- 4. .context/ tree ---
    console.log('\n  --- .context/ tree ---');
    const contextDir = path.join(tmpDir, '.context');
    assert(fileExists(path.join(contextDir, 'vision.md')), 'vision.md exists');
    assert(fileNonEmpty(path.join(contextDir, 'vision.md')), 'vision.md has content');
    assert(fileExists(path.join(contextDir, 'lessons', 'index.md')), 'lessons/index.md exists');
    assert(fileExists(path.join(contextDir, 'directives', '.gitkeep')), 'directives/.gitkeep exists');
    assert(fileExists(path.join(contextDir, 'preferences.md')), 'preferences.md exists');
    assert(fileExists(path.join(contextDir, 'backlog.json')), 'backlog.json exists');

    // --- 5. CLAUDE.md with agent roster ---
    console.log('\n  --- CLAUDE.md ---');
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    assert(fileExists(claudeMdPath), 'CLAUDE.md exists');

    if (fileExists(claudeMdPath)) {
      const claudeContent = fs.readFileSync(claudeMdPath, 'utf-8');
      // Check for agent roster table markers
      assert(claudeContent.includes('| Name |'), 'CLAUDE.md contains roster table header');

      // Check each agent name appears in the table
      for (const agent of agents) {
        assert(claudeContent.includes(agent.name), `CLAUDE.md contains agent name: ${agent.name}`);
      }
    }

    // --- 6. Platform symlink ---
    console.log('\n  --- Platform symlink ---');
    const claudeDir = path.join(tmpDir, '.claude');
    assert(fileExists(claudeDir), '.claude/ exists');
    try {
      const linkStat = fs.lstatSync(claudeDir);
      assert(linkStat.isSymbolicLink(), '.claude/ is a symlink to .gruai/');
    } catch {
      assert(false, '.claude/ is a symlink');
    }

    // --- 7. gruai.config.json ---
    console.log('\n  --- gruai.config.json ---');
    const configPath = path.join(tmpDir, 'gruai.config.json');
    assert(fileExists(configPath), 'gruai.config.json exists');

  } finally {
    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ===========================================================================
// Run validations for multiple presets
// ===========================================================================

async function main() {
  // Test starter preset (4 agents)
  await validateScaffold('starter', PRESET_ROLES['starter']!);

  // Test standard preset (7 agents)
  await validateScaffold('standard', PRESET_ROLES['standard']!);

  // Test full preset (11 agents)
  await validateScaffold('full', getAllRoleIds());

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
