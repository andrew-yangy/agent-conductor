import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ConductorConfig, ProjectConfig } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.conductor');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function resolveHome(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Decode a ~/.claude/projects/ directory name back to a real filesystem path.
 *
 * Directory names encode paths by replacing `/` with `-`, e.g.:
 *   `-Users-yangyang-Repos-gruai` -> `/Users/yangyang/Repos/gruai`
 *
 * The challenge: path components can contain hyphens (e.g. `gruai`).
 * We solve this by trying all possible hyphen->slash splits and checking which
 * decoded path actually exists on disk.
 */
function decodeProjectDirName(dirName: string): string | null {
  // Must start with `-` (represents leading `/`)
  if (!dirName.startsWith('-')) return null;

  const stripped = dirName.slice(1); // remove leading `-`
  const parts = stripped.split('-');

  // Use dynamic programming / recursive backtracking to find valid path
  // Try combining adjacent parts with hyphens to form directory names
  const result = findValidPath(parts, 0, '/');
  return result;
}

/**
 * Recursively try combining parts to find a path that exists on disk.
 * parts: array of hyphen-split segments
 * index: current position in parts
 * currentPath: path built so far
 */
function findValidPath(parts: string[], index: number, currentPath: string): string | null {
  if (index >= parts.length) {
    // We've consumed all parts. Check if the full path exists
    return fs.existsSync(currentPath) ? currentPath : null;
  }

  // Try progressively longer component names (joining with hyphens)
  for (let end = index + 1; end <= parts.length; end++) {
    const component = parts.slice(index, end).join('-');
    const candidatePath = path.join(currentPath, component);

    // For intermediate components, check if this directory exists before recursing
    if (end < parts.length) {
      if (fs.existsSync(candidatePath)) {
        const result = findValidPath(parts, end, candidatePath);
        if (result) return result;
      }
    } else {
      // Last component: check if the full path exists
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

/**
 * Derive a human-friendly project name from a filesystem path.
 * Uses the last directory component, title-cased.
 * e.g. `/Users/yangyang/Repos/gruai` -> `Agent Conductor`
 */
function deriveProjectName(projectPath: string): string {
  const basename = path.basename(projectPath);
  return basename
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Discover conductor-enabled projects from ~/.claude/projects/.
 * Scans subdirectories, decodes their names to real paths, and checks
 * for `.context/` to identify conductor-enabled repos.
 */
export function discoverProjects(claudeHome: string): ProjectConfig[] {
  const projectsDir = path.join(claudeHome, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const discovered: ProjectConfig[] = [];

  let entries: string[];
  try {
    entries = fs.readdirSync(projectsDir).filter((name) => {
      if (name.startsWith('.')) return false;
      try {
        return fs.statSync(path.join(projectsDir, name)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }

  for (const entry of entries) {
    const decodedPath = decodeProjectDirName(entry);
    if (!decodedPath) continue;

    // Only include projects that have .context/ (conductor-enabled)
    const contextDir = path.join(decodedPath, '.context');
    if (!fs.existsSync(contextDir)) continue;

    discovered.push({
      name: deriveProjectName(decodedPath),
      path: decodedPath,
      source: 'discovered',
    });
  }

  console.log(`[config] Discovered ${discovered.length} conductor-enabled project(s) from ${projectsDir}`);
  for (const p of discovered) {
    console.log(`[config]   - ${p.name}: ${p.path}`);
  }

  return discovered;
}

function defaultConfig(): ConductorConfig {
  return {
    projects: [],
    claudeHome: '~/.claude',
    server: {
      port: 4444,
    },
    notifications: {
      macOS: true,
      browser: true,
    },
  };
}

export function loadConfig(): ConductorConfig {
  try {
    let configProjects: ProjectConfig[] = [];
    let claudeHome = '~/.claude';
    let serverPort = 4444;
    let notifications = { macOS: true, browser: true };

    // process.env.PORT takes precedence over config.json and default
    const envPort = process.env.PORT;
    if (envPort !== undefined) {
      const parsed_port = parseInt(envPort, 10);
      if (!Number.isNaN(parsed_port)) {
        serverPort = parsed_port;
      }
    }

    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ConductorConfig>;
      configProjects = (parsed.projects ?? []).map((p) => ({
        ...p,
        source: 'config' as const,
      }));
      claudeHome = parsed.claudeHome ?? claudeHome;
      // Only use config port if env var was not set
      if (envPort === undefined) {
        serverPort = parsed.server?.port ?? serverPort;
      }
      notifications = {
        macOS: parsed.notifications?.macOS ?? notifications.macOS,
        browser: parsed.notifications?.browser ?? notifications.browser,
      };
    } else {
      // Create default config file
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      const defaults = defaultConfig();
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), 'utf-8');
      console.log(`[config] Created default config at ${CONFIG_PATH}`);
    }

    const resolvedClaudeHome = resolveHome(claudeHome);

    // Discover projects from ~/.claude/projects/
    const discoveredProjects = discoverProjects(resolvedClaudeHome);

    // Merge: discovered projects are primary, config.json projects fill gaps
    // Deduplicate by resolved path
    const seenPaths = new Set<string>();
    const mergedProjects: ProjectConfig[] = [];

    // Add discovered projects first (they take priority)
    for (const dp of discoveredProjects) {
      const resolved = path.resolve(dp.path);
      if (!seenPaths.has(resolved)) {
        seenPaths.add(resolved);
        mergedProjects.push(dp);
      }
    }

    // Add config.json projects that weren't already discovered
    for (const cp of configProjects) {
      const resolved = path.resolve(resolveHome(cp.path));
      if (!seenPaths.has(resolved)) {
        seenPaths.add(resolved);
        mergedProjects.push({
          ...cp,
          path: resolveHome(cp.path),
        });
      } else {
        // Config entry exists for a discovered project — use config's name if provided
        const existing = mergedProjects.find(
          (p) => path.resolve(p.path) === resolved
        );
        if (existing && cp.name) {
          existing.name = cp.name;
        }
      }
    }

    const config: ConductorConfig = {
      projects: mergedProjects,
      claudeHome: resolvedClaudeHome,
      server: { port: serverPort },
      notifications,
    };

    return config;
  } catch (err) {
    console.error(`[config] Error loading config from ${CONFIG_PATH}, using defaults:`, err);
    const defaults = defaultConfig();
    return {
      ...defaults,
      claudeHome: resolveHome(defaults.claudeHome),
    };
  }
}

