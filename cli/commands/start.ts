/**
 * gruai start — Launch the dashboard server.
 *
 * Checks that the project is initialized, resolves the server entry point
 * from the package, and spawns it as a child process.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { c } from '../lib/color.js';
import { findPackageRoot } from '../lib/paths.js';

function printStartHelp(): void {
  console.log(`
${c.bold('gruai start')} — Launch the dashboard server

${c.bold('Usage:')}
  gru-ai start [options]

${c.bold('Options:')}
  --port <port>  Server port (default: 4444)
  --help         Show this help message

${c.bold('Examples:')}
  gru-ai start
  gru-ai start --port 8080
`);
}

function isInitialized(projectPath: string): boolean {
  return (
    fs.existsSync(path.join(projectPath, '.context')) ||
    fs.existsSync(path.join(projectPath, '.gruai')) ||
    fs.existsSync(path.join(projectPath, 'gruai.config.json'))
  );
}

export async function runStart(flags: Record<string, string | boolean>): Promise<void> {
  if (flags['help']) {
    printStartHelp();
    process.exit(0);
  }

  const projectPath = typeof flags['path'] === 'string'
    ? path.resolve(flags['path'])
    : process.cwd();

  // Check initialization — require .context/ or .gruai/ or gruai.config.json
  if (!isInitialized(projectPath)) {
    console.error(c.red('\n  Error: No .context/ directory found.'));
    console.error(`  This project has not been initialized with gruai.`);
    console.error(`  Run ${c.cyan("'gru-ai init'")} first to scaffold the framework.\n`);
    process.exit(1);
  }

  // Resolve server entry point from the package
  const pkgRoot = findPackageRoot();
  const serverEntry = path.join(pkgRoot, 'dist-server', 'server', 'index.js');

  if (!fs.existsSync(serverEntry)) {
    console.error(c.red(`\n  Error: Server entry not found at ${serverEntry}`));
    console.error(c.dim('  The package may not be built. Try: npm run build\n'));
    process.exit(1);
  }

  const port = typeof flags['port'] === 'string' ? flags['port'] : '4444';

  console.log(`\n  ${c.bold('gruai')} ${c.dim('-- Dashboard Server')}`);
  console.log(`  ${c.dim('Port:')} ${c.cyan(port)}`);
  console.log(`  ${c.dim('Project:')} ${projectPath}\n`);

  // Spawn server as child process
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  env['PORT'] = port;
  env['GRUAI_PROJECT_PATH'] = projectPath;

  const child = spawn('node', [serverEntry], {
    cwd: projectPath,
    env,
    stdio: 'inherit',
  });

  // Forward termination signals
  const cleanup = (): void => {
    child.kill('SIGTERM');
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  child.on('exit', (code) => {
    process.off('SIGINT', cleanup);
    process.off('SIGTERM', cleanup);
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(c.red(`\n  Error starting server: ${err.message}\n`));
    process.exit(1);
  });
}
