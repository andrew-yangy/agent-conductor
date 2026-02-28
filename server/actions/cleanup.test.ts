import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { deleteTeam } from './cleanup.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tmpDir: string;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));
  fs.mkdirSync(path.join(tmpDir, 'teams'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'tasks'), { recursive: true });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Create a fresh team for each test
  const teamDir = path.join(tmpDir, 'teams', 'test-team');
  const tasksDir = path.join(tmpDir, 'tasks', 'test-team');
  fs.mkdirSync(teamDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(teamDir, 'config.json'), '{}');
  fs.writeFileSync(path.join(tasksDir, 'task1.json'), '{}');
});

describe('deleteTeam - valid operations', () => {
  it('deletes a valid team and its tasks', () => {
    const result = deleteTeam(tmpDir, 'test-team');
    assert.equal(result.success, true);
    assert.ok(!fs.existsSync(path.join(tmpDir, 'teams', 'test-team')));
    assert.ok(!fs.existsSync(path.join(tmpDir, 'tasks', 'test-team')));
  });

  it('accepts team name with hyphens', () => {
    fs.mkdirSync(path.join(tmpDir, 'teams', 'my-team'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tasks', 'my-team'), { recursive: true });
    const result = deleteTeam(tmpDir, 'my-team');
    assert.equal(result.success, true);
  });

  it('accepts team name with underscores', () => {
    fs.mkdirSync(path.join(tmpDir, 'teams', 'my_team'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tasks', 'my_team'), { recursive: true });
    const result = deleteTeam(tmpDir, 'my_team');
    assert.equal(result.success, true);
  });

  it('accepts team name with digits', () => {
    fs.mkdirSync(path.join(tmpDir, 'teams', 'team42'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tasks', 'team42'), { recursive: true });
    const result = deleteTeam(tmpDir, 'team42');
    assert.equal(result.success, true);
  });

  it('returns not found for nonexistent team', () => {
    const result = deleteTeam(tmpDir, 'nonexistent');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Team not found');
  });
});

describe('deleteTeam - path traversal prevention', () => {
  it('rejects ../', () => {
    const result = deleteTeam(tmpDir, '../../../etc');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects internal slash', () => {
    const result = deleteTeam(tmpDir, 'teams/../../../etc');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects bare ..', () => {
    const result = deleteTeam(tmpDir, '..');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects dot-prefixed names', () => {
    const result = deleteTeam(tmpDir, '.hidden');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });
});

describe('deleteTeam - special character rejection', () => {
  it('rejects empty string', () => {
    const result = deleteTeam(tmpDir, '');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects spaces', () => {
    const result = deleteTeam(tmpDir, 'my team');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects semicolons (command injection)', () => {
    const result = deleteTeam(tmpDir, 'team;rm -rf /');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects backticks (command substitution)', () => {
    const result = deleteTeam(tmpDir, 'team`whoami`');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects dollar sign (variable expansion)', () => {
    const result = deleteTeam(tmpDir, 'team$HOME');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects null bytes', () => {
    const result = deleteTeam(tmpDir, 'team\x00evil');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects newlines', () => {
    const result = deleteTeam(tmpDir, 'team\nevil');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects backslashes', () => {
    const result = deleteTeam(tmpDir, 'team\\evil');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });

  it('rejects unicode characters', () => {
    const result = deleteTeam(tmpDir, 'team☠️');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid team name');
  });
});
