/**
 * Path resolution — find the gru-ai package root from compiled or source context.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Walk up from the current file to find the nearest package.json with name "gru-ai".
 * Works from both:
 *  - dist-cli/lib/ (compiled npm install)
 *  - cli/lib/ (tsx dev)
 */
export function findPackageRoot(): string {
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
  throw new Error(
    'Could not find gru-ai package root (no package.json with name "gru-ai" found walking up from ' +
    __dirname + '). Is gruai installed correctly?'
  );
}

const REPO_ROOT = findPackageRoot();

export const TEMPLATES_DIR = path.join(REPO_ROOT, 'cli', 'templates');
export const SKILLS_SRC_DIR = path.join(REPO_ROOT, '.claude', 'skills');
export const ROLE_TEMPLATES_DIR = path.join(TEMPLATES_DIR, 'agent-roles');
