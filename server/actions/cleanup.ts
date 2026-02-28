import fs from 'node:fs';
import path from 'node:path';

const TEAM_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export function deleteTeam(claudeHome: string, teamName: string): { success: boolean; error?: string } {
  // Validate: strict allowlist + path containment check
  if (!teamName || !TEAM_NAME_REGEX.test(teamName)) {
    return { success: false, error: 'Invalid team name' };
  }

  const teamDir = path.join(claudeHome, 'teams', teamName);
  const tasksDir = path.join(claudeHome, 'tasks', teamName);

  // Defense in depth: verify resolved paths stay within expected directories
  const resolvedTeamDir = path.resolve(teamDir);
  const resolvedTasksDir = path.resolve(tasksDir);
  const resolvedTeamsRoot = path.resolve(claudeHome, 'teams');
  const resolvedTasksRoot = path.resolve(claudeHome, 'tasks');
  if (!resolvedTeamDir.startsWith(resolvedTeamsRoot + path.sep) ||
      !resolvedTasksDir.startsWith(resolvedTasksRoot + path.sep)) {
    return { success: false, error: 'Invalid team name' };
  }

  let deleted = false;

  try {
    if (fs.existsSync(teamDir)) {
      fs.rmSync(teamDir, { recursive: true });
      deleted = true;
    }
  } catch (err) {
    return { success: false, error: `Failed to delete team dir: ${err}` };
  }

  try {
    if (fs.existsSync(tasksDir)) {
      fs.rmSync(tasksDir, { recursive: true });
      deleted = true;
    }
  } catch {
    // Non-fatal: team dir already deleted
  }

  return { success: deleted, error: deleted ? undefined : 'Team not found' };
}
