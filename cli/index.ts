#!/usr/bin/env node
import { runInit } from './commands/init.js';

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`
agent-conductor — Autonomous AI company framework

Usage:
  agent-conductor <command> [options]

Commands:
  init    Scaffold agent-conductor into a project

Options:
  --help  Show this help message

Run 'agent-conductor init --help' for init-specific options.
`);
}

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  if (command === 'init') {
    const flags = parseFlags(args.slice(1));
    await runInit(flags);
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
