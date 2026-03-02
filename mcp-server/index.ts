#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { conductorStatus } from './tools/status.js';
import { listBacklog, addBacklogItem } from './tools/backlog.js';
import { listDirectives, launchDirective } from './tools/directive.js';
import { readReport, listReports } from './tools/report.js';

const server = new McpServer({
  name: 'agent-conductor',
  version: '0.1.0',
});

// --- conductor_status ---
server.tool(
  'conductor_status',
  'Returns current conductor state: active goals, open features, backlog summary, pending directives, recent completions. Reads from .context/state/ JSON files.',
  async () => {
    try {
      const result = conductorStatus();
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// --- conductor_backlog ---
server.tool(
  'conductor_backlog',
  'List backlog items for a goal, filtered by priority. Returns pending and done items from .context/state/backlogs.json.',
  {
    goal_id: z.string().optional().describe('Goal ID to filter by (e.g., "agent-conductor", "buywisely-growth"). Omit for all goals.'),
    priority: z.string().optional().describe('Priority filter (e.g., "P0", "P1", "P2"). Omit for all priorities.'),
  },
  async ({ goal_id, priority }) => {
    try {
      const result = listBacklog(goal_id, priority);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// --- conductor_add_backlog ---
server.tool(
  'conductor_add_backlog',
  'Add a new item to a goal\'s backlog.md file. Creates the backlog file if it does not exist.',
  {
    goal_id: z.string().describe('Goal ID (directory name under .context/goals/, e.g., "agent-conductor")'),
    title: z.string().describe('Title of the backlog item'),
    priority: z.string().describe('Priority level (P0, P1, P2, or P3)'),
    description: z.string().describe('Description of the item'),
    trigger: z.string().optional().describe('Trigger condition for when this item should be activated (used by /scout)'),
  },
  async ({ goal_id, title, priority, description, trigger }) => {
    try {
      const result = addBacklogItem(goal_id, title, priority, description, trigger);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// --- conductor_launch_directive ---
server.tool(
  'conductor_launch_directive',
  'Launch a directive from inbox/. Shows the directive preview and the CLI command to execute it. Pass no arguments to list available directives.',
  {
    directive_name: z.string().optional().describe('Name of the directive file (without .md extension). Omit to list all available directives.'),
  },
  async ({ directive_name }) => {
    try {
      const result = directive_name
        ? launchDirective(directive_name)
        : listDirectives();
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// --- conductor_report ---
server.tool(
  'conductor_report',
  'Read CEO reports. Returns the latest report by default, or a specific one by name. Pass report_name="list" to see all available reports.',
  {
    report_name: z.string().optional().describe('Report name to read (e.g., "work-state-management-2026-03-02"). Pass "list" to list all reports. Omit for the latest report.'),
  },
  async ({ report_name }) => {
    try {
      const result =
        report_name === 'list' ? listReports() : readReport(report_name);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      return {
        content: [
          { type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  }
);

// --- Start the server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running on stdio
  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error('[conductor-mcp] Server started');
}

main().catch((err) => {
  console.error('[conductor-mcp] Fatal error:', err);
  process.exit(1);
});
