/**
 * gruai init — Interactive project setup.
 *
 * Prompts: project name, team size preset, agent name customization, platform selection.
 * Then delegates to scaffold.ts to create all files.
 *
 * Uses ONLY Node readline — no external dependencies.
 */
export declare function runInit(flags: Record<string, string | boolean>): Promise<void>;
