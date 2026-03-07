/**
 * validate-integration.ts -- Full integration smoke test
 *
 * Ties together all components:
 * 1. Create synthetic directive tree
 * 2. Run all 3 hook scripts (validate-cast, validate-project-json, validate-gate)
 * 3. Verify adapters
 * 4. Run type-check
 * 5. Print summary report
 *
 * Run: npx tsx scripts/validate-integration.ts
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { ClaudeCodeAdapter } from '../server/platform/claude-code.js';

const REPO_ROOT = path.resolve(import.meta.dirname!, '..');
const HOOKS_DIR = path.join(REPO_ROOT, '.claude', 'hooks');

let passed = 0;
let failed = 0;
const results: Array<{ section: string; label: string; ok: boolean }> = [];

function assert(section: string, condition: boolean, label: string): void {
  results.push({ section, label, ok: condition });
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

// ===========================================================================
// 1. Create synthetic directive tree
// ===========================================================================
console.log('\n=== 1. Create synthetic directive tree ===');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gruai-integration-'));
const directiveDir = path.join(tmpDir, '.context', 'directives', 'smoke-test');
const projectDir = path.join(directiveDir, 'projects', 'smoke-proj');
fs.mkdirSync(projectDir, { recursive: true });

// Initialize git repo (needed by validate-project-json.sh and validate-gate.sh)
execSync('git init -q', { cwd: tmpDir });

// directive.json
const directiveJson = {
  id: 'smoke-test',
  title: 'Integration Smoke Test',
  status: 'in_progress',
  weight: 'heavyweight',
  current_step: 'execute',
  pipeline: {
    triage: { status: 'completed' },
    read: { status: 'completed' },
    context: { status: 'completed' },
    challenge: { status: 'completed' },
    brainstorm: { status: 'completed' },
    plan: { status: 'completed' },
    audit: { status: 'completed' },
    approve: { status: 'completed' },
    'project-brainstorm': { status: 'completed' },
    setup: { status: 'completed' },
    execute: { status: 'active' },
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
fs.writeFileSync(path.join(directiveDir, 'directive.json'), JSON.stringify(directiveJson, null, 2));

// directive.md
fs.writeFileSync(path.join(directiveDir, 'directive.md'), '# Smoke Test\n\nIntegration smoke test directive.\n');

// brainstorm.md (required for plan gate)
fs.writeFileSync(path.join(directiveDir, 'brainstorm.md'), '# Brainstorm\n\nSmoke test brainstorm.\n');

// audit.md (required for approve gate)
fs.writeFileSync(path.join(directiveDir, 'audit.md'), '# Audit\n\nSmoke test audit.\n');

// plan.json (required for audit and approve gates)
const planJson = {
  projects: [
    {
      id: 'smoke-proj',
      title: 'Smoke Project',
      agent: ['riley'],
      reviewers: ['sarah'],
      complexity: 'simple',
      scope_summary: 'Integration test project',
    },
  ],
};
fs.writeFileSync(path.join(directiveDir, 'plan.json'), JSON.stringify(planJson, null, 2));

// project.json
const projectJson = {
  id: 'smoke-proj',
  title: 'Smoke Project',
  status: 'in_progress',
  description: 'Integration smoke test project',
  agent: ['riley'],
  reviewers: ['sarah'],
  scope: { in: ['integration testing'], out: ['nothing'] },
  dod: [{ criterion: 'Smoke test passes', met: false }],
  tasks: [
    {
      id: 'smoke-task',
      title: 'Smoke Task',
      status: 'in_progress',
      agent: ['riley'],
      dod: [{ criterion: 'task passes', met: false }],
    },
  ],
};
fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(projectJson, null, 2));

// Commit everything so git rev-parse works
execSync('git add -A && git commit -q -m "init"', { cwd: tmpDir });

assert('setup', true, 'Synthetic directive tree created');
assert('setup', fs.existsSync(path.join(directiveDir, 'directive.json')), 'directive.json exists');
assert('setup', fs.existsSync(path.join(projectDir, 'project.json')), 'project.json exists');

// ===========================================================================
// 2. Run all 3 hook scripts
// ===========================================================================
console.log('\n=== 2. Hook script validation ===');

// 2a. validate-cast.sh
try {
  const castResult = execSync(
    `echo '${JSON.stringify(planJson)}' | bash "${HOOKS_DIR}/validate-cast.sh"`,
    { encoding: 'utf-8', cwd: tmpDir }
  ).trim();
  const castJson = JSON.parse(castResult);
  assert('hooks', castJson.valid === true, 'validate-cast.sh returns valid:true for plan.json');
} catch (e: any) {
  assert('hooks', false, `validate-cast.sh: ${e.message}`);
}

// 2b. validate-project-json.sh
try {
  const relDir = '.context/directives/smoke-test';
  const input = JSON.stringify({ directive_dir: relDir, project_id: 'smoke-proj' });
  const projResult = execSync(
    `echo '${input}' | bash "${HOOKS_DIR}/validate-project-json.sh"`,
    { encoding: 'utf-8', cwd: tmpDir }
  ).trim();
  const projJson = JSON.parse(projResult);
  assert('hooks', projJson.valid === true, 'validate-project-json.sh returns valid:true');
} catch (e: any) {
  assert('hooks', false, `validate-project-json.sh: ${e.message}`);
}

// 2c. validate-gate.sh for triage
try {
  const triageResult = execSync(
    `bash "${HOOKS_DIR}/validate-gate.sh" ".context/directives/smoke-test" triage`,
    { encoding: 'utf-8', cwd: tmpDir }
  ).trim();
  const triageJson = JSON.parse(triageResult);
  assert('hooks', triageJson.valid === true, 'validate-gate.sh triage returns valid:true');
} catch (e: any) {
  assert('hooks', false, `validate-gate.sh triage: ${e.message}`);
}

// ===========================================================================
// 3. validate-gate.sh for triage, plan, execute in sequence
// ===========================================================================
console.log('\n=== 3. Gate validation sequence ===');

const gateSteps = ['triage', 'plan', 'execute'];
for (const step of gateSteps) {
  try {
    const result = execSync(
      `bash "${HOOKS_DIR}/validate-gate.sh" ".context/directives/smoke-test" ${step}`,
      { encoding: 'utf-8', cwd: tmpDir }
    ).trim();
    const json = JSON.parse(result);
    assert('gates', json.valid === true, `validate-gate.sh ${step} passes`);
  } catch (e: any) {
    assert('gates', false, `validate-gate.sh ${step}: ${e.message}`);
  }
}

// Clean up temp dir
fs.rmSync(tmpDir, { recursive: true, force: true });

// ===========================================================================
// 4. ClaudeCodeAdapter verification
// ===========================================================================
console.log('\n=== 4. Adapter verification ===');

try {
  const claudeHome = path.join(os.homedir(), '.claude');
  const adapter = new ClaudeCodeAdapter(claudeHome);
  assert('adapters', adapter != null, 'ClaudeCodeAdapter instantiates without errors');

  const sessionFiles = adapter.discoverSessionFiles();
  assert('adapters', sessionFiles instanceof Map, 'discoverSessionFiles returns a Map');
  assert('adapters', sessionFiles.size > 0, `discoverSessionFiles found ${sessionFiles.size} files`);

  const caps = adapter.getPlatformCapabilities();
  assert('adapters', caps.supportsFileWatching === true, 'Platform capabilities are correct');
} catch (e: any) {
  assert('adapters', false, `Adapter error: ${e.message}`);
}

// ===========================================================================
// 5. npm run type-check
// ===========================================================================
console.log('\n=== 5. Type-check verification ===');

try {
  execSync('npx tsc --noEmit', { cwd: REPO_ROOT, encoding: 'utf-8', stdio: 'pipe' });
  assert('typecheck', true, 'npm run type-check passes with zero errors');
} catch (e: any) {
  const stderr = e.stderr || e.stdout || e.message;
  console.log(`  Type-check errors:\n${stderr.slice(0, 500)}`);
  assert('typecheck', false, 'npm run type-check passes with zero errors');
}

// ===========================================================================
// 6. Summary Report
// ===========================================================================
console.log('\n');
console.log('='.repeat(60));
console.log('  INTEGRATION SMOKE TEST SUMMARY');
console.log('='.repeat(60));

const sections = [...new Set(results.map(r => r.section))];
for (const section of sections) {
  const sectionResults = results.filter(r => r.section === section);
  const sectionPassed = sectionResults.filter(r => r.ok).length;
  const sectionTotal = sectionResults.length;
  const status = sectionPassed === sectionTotal ? 'PASS' : 'FAIL';
  console.log(`  [${status}] ${section}: ${sectionPassed}/${sectionTotal}`);
}

console.log('-'.repeat(60));
console.log(`  TOTAL: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
