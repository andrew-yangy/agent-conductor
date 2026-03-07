import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const DB_DIR = path.join(os.homedir(), '.conductor');
const DB_PATH = path.join(DB_DIR, 'conductor.db');
let db = null;
export function getDb() {
    if (db)
        return db;
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      project TEXT,
      metadata_json TEXT
    )
  `);
    // Index for querying by session and time
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
  `);
    console.log(`[db] SQLite database initialized at ${DB_PATH}`);
    return db;
}
export function insertEvent(event) {
    const database = getDb();
    const stmt = database.prepare(`
    INSERT OR REPLACE INTO events (id, type, session_id, timestamp, message, project, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(event.id, event.type, event.sessionId, event.timestamp, event.message, event.project ?? null, event.metadata ? JSON.stringify(event.metadata) : null);
}
export function getRecentEvents(limit = 100) {
    const database = getDb();
    const rows = database
        .prepare(`SELECT * FROM events ORDER BY timestamp DESC LIMIT ?`)
        .all(limit);
    return rows.map((row) => ({
        id: row.id,
        type: row.type,
        sessionId: row.session_id,
        timestamp: row.timestamp,
        message: row.message,
        project: row.project ?? undefined,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
}
export function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
