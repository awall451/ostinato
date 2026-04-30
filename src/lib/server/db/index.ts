import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _raw: Database.Database | null = null;

function dbPath(): string {
	return process.env.OSTINATO_DB_PATH ?? './data/ostinato.db';
}

export function getDb(): {
	db: BetterSQLite3Database<typeof schema>;
	raw: Database.Database;
} {
	if (_db && _raw) return { db: _db, raw: _raw };
	const path = dbPath();
	mkdirSync(dirname(path), { recursive: true });
	_raw = new Database(path);
	_raw.pragma('journal_mode = WAL');
	_raw.pragma('foreign_keys = ON');
	_db = drizzle(_raw, { schema });
	return { db: _db, raw: _raw };
}

export { schema };
