import Database from 'better-sqlite3';
import type { HookEvent } from './types.js';
export declare function getDb(): Database.Database;
export declare function insertEvent(event: HookEvent): void;
export declare function getRecentEvents(limit?: number): HookEvent[];
export declare function closeDb(): void;
