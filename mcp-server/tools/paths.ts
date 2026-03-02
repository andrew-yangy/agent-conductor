import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface ConductorConfig {
  projects: Array<{ name: string; path: string; contextPath?: string }>;
}

let resolvedProjectPath: string | null = null;

/**
 * Resolves the project path from env var or ~/.conductor/config.json.
 * Caches the result after first resolution.
 */
export function getProjectPath(): string {
  if (resolvedProjectPath) return resolvedProjectPath;

  // 1. Check env var
  const envPath = process.env['CONDUCTOR_PROJECT_PATH'];
  if (envPath && fs.existsSync(envPath)) {
    resolvedProjectPath = envPath;
    return resolvedProjectPath;
  }

  // 2. Read from ~/.conductor/config.json
  const configPath = path.join(os.homedir(), '.conductor', 'config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as ConductorConfig;
    if (config.projects.length > 0) {
      const p = config.projects[0]!.path;
      const resolved = p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
      if (fs.existsSync(resolved)) {
        resolvedProjectPath = resolved;
        return resolvedProjectPath;
      }
    }
  }

  throw new Error(
    'Cannot resolve project path. Set CONDUCTOR_PROJECT_PATH env var or configure ~/.conductor/config.json'
  );
}

/** Path to .context/state/ directory */
export function statePath(file: string): string {
  return path.join(getProjectPath(), '.context', 'state', file);
}

/** Path to .context/goals/ directory */
export function goalsPath(...segments: string[]): string {
  return path.join(getProjectPath(), '.context', 'goals', ...segments);
}

/** Path to .context/ conductor directory */
export function conductorPath(...segments: string[]): string {
  return path.join(getProjectPath(), '.context', ...segments);
}

/** Safely read a JSON file, returning null on any error */
export function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Safely read a text file, returning null on any error */
export function readTextSafe(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
