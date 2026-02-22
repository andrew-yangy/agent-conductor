import fs from 'node:fs';
import path from 'node:path';

export function deleteTeam(claudeHome: string, teamName: string): { success: boolean; error?: string } {
  // Validate: no path traversal
  if (teamName.includes('/') || teamName.includes('..')) {
    return { success: false, error: 'Invalid team name' };
  }

  const teamDir = path.join(claudeHome, 'teams', teamName);
  const tasksDir = path.join(claudeHome, 'tasks', teamName);

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
