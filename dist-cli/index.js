#!/usr/bin/env node
import { runInit } from './commands/init.js';
import { runStart } from './commands/start.js';
import { runUpdate } from './commands/update.js';
import { c } from './lib/color.js';
const VERSION = '0.1.0';
const args = process.argv.slice(2);
const command = args[0];
function printUsage() {
    console.log(`
${c.bold('gruai')} ${c.dim(`v${VERSION}`)} — Autonomous AI company framework

${c.bold('Usage:')}
  gru-ai <command> [options]

${c.bold('Commands:')}
  ${c.cyan('init')}      Scaffold gruai into a project (interactive setup)
  ${c.cyan('start')}     Launch the dashboard server
  ${c.cyan('update')}    Update framework files to latest version

${c.bold('Options:')}
  --help     Show this help message
  --version  Show version number

Run ${c.dim("'gru-ai <command> --help'")} for command-specific options.
`);
}
function parseFlags(argv) {
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--'))
            continue;
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
            flags[key] = next;
            i++;
        }
        else {
            flags[key] = true;
        }
    }
    return flags;
}
async function main() {
    if (!command || command === '--help' || command === '-h') {
        printUsage();
        process.exit(0);
    }
    if (command === '--version' || command === '-v') {
        console.log(VERSION);
        process.exit(0);
    }
    const flags = parseFlags(args.slice(1));
    switch (command) {
        case 'init':
            await runInit(flags);
            break;
        case 'start':
            await runStart(flags);
            break;
        case 'update':
            await runUpdate(flags);
            break;
        default:
            console.error(c.red(`Unknown command: ${command}`));
            printUsage();
            process.exit(1);
    }
}
main().catch((err) => {
    console.error(c.red('Fatal error:'), err instanceof Error ? err.message : String(err));
    process.exit(1);
});
