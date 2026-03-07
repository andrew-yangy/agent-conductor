import type { ConductorConfig, ProjectConfig } from './types.js';
/**
 * Discover conductor-enabled projects from ~/.claude/projects/.
 * Scans subdirectories, decodes their names to real paths, and checks
 * for `.context/` to identify conductor-enabled repos.
 */
export declare function discoverProjects(claudeHome: string): ProjectConfig[];
export declare function loadConfig(): ConductorConfig;
