/**
 * gruai update — Update framework files to latest version.
 *
 * Strategy: backup-and-overwrite.
 *  - Backs up existing skill files and CLAUDE.md to .gruai-backup/{timestamp}/
 *  - Overwrites skills and re-renders CLAUDE.md with latest template
 *  - Preserves: .context/ (user data), agent-registry.json (team names), agents/*.md, gruai.config.json
 */
export declare function runUpdate(flags: Record<string, string | boolean>): Promise<void>;
