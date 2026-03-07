/**
 * Centralized path resolution for the gru-ai server.
 *
 * Two root directories matter at runtime:
 *
 * 1. **Consumer project root** (`consumerRoot`): The directory where the user
 *    ran `gruai start`. This is where `.context/`, `.claude/agent-registry.json`,
 *    and session data live. Resolved from `GRUAI_PROJECT_PATH` env var (set by
 *    the CLI) or falls back to `process.cwd()`.
 *
 * 2. **Package root** (`packageRoot`): The gru-ai npm package installation
 *    directory. This is where `dist/` (built dashboard assets) and bundled
 *    defaults live. Resolved by walking up from this file's location to find
 *    the package.json with `"name": "gru-ai"`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Package root resolution (where gru-ai is installed)
// ---------------------------------------------------------------------------

function resolvePackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg: { name?: string } = JSON.parse(raw) as { name?: string };
        if (pkg.name === 'gru-ai') return dir;
      } catch {
        // Malformed package.json, keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: in dev mode, __dirname is server/ so parent is repo root
  const devRoot = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(devRoot, 'package.json'))) {
    return devRoot;
  }
  throw new Error(
    `Could not find gru-ai package root (walked up from ${__dirname})`
  );
}

// ---------------------------------------------------------------------------
// Consumer project root resolution (the user's project)
// ---------------------------------------------------------------------------

function resolveConsumerRoot(): string {
  // CLI sets this env var when spawning the server
  const envPath = process.env['GRUAI_PROJECT_PATH'];
  if (envPath) return path.resolve(envPath);
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Exported resolved paths (computed once at module load)
// ---------------------------------------------------------------------------

/** The gru-ai package installation directory (contains dist/, dist-server/, etc.) */
export const packageRoot = resolvePackageRoot();

/** The consumer's project directory (contains .context/, .claude/, etc.) */
export const consumerRoot = resolveConsumerRoot();

// ---------------------------------------------------------------------------
// Derived path helpers
// ---------------------------------------------------------------------------

/** Path to the built dashboard assets (dist/) inside the package */
export function distDir(): string {
  return path.join(packageRoot, 'dist');
}

/** Path to the consumer's .context/ directory */
export function contextDir(): string {
  return path.join(consumerRoot, '.context');
}

/** Path to the consumer's .context/directives/ directory */
export function directivesDir(): string {
  return path.join(consumerRoot, '.context', 'directives');
}

/**
 * Load agent-registry.json. Looks in:
 * 1. Consumer's .claude/agent-registry.json
 * 2. Consumer's .gruai/agent-registry.json (scaffold output)
 * 3. Bundled default in package's .claude/agent-registry.json
 *
 * Returns the parsed JSON or null if none found.
 */
export function loadAgentRegistry(): unknown {
  const candidates = [
    path.join(consumerRoot, '.claude', 'agent-registry.json'),
    path.join(consumerRoot, '.gruai', 'agent-registry.json'),
    path.join(packageRoot, '.claude', 'agent-registry.json'),
  ];

  for (const candidate of candidates) {
    try {
      const raw = fs.readFileSync(candidate, 'utf-8');
      const data = JSON.parse(raw);
      console.log(`[paths] Loaded agent-registry from ${candidate}`);
      return data;
    } catch {
      continue;
    }
  }

  console.log('[paths] No agent-registry.json found, using empty default');
  return { agents: [] };
}
