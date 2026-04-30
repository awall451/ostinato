import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');

const dbPath = process.env.OSTINATO_DB_PATH ?? '/data/ostinato.db';
mkdirSync(dirname(dbPath), { recursive: true });

const raw = new Database(dbPath);
raw.pragma('journal_mode = WAL');
raw.pragma('foreign_keys = ON');
const db = drizzle(raw);

const migrationsFolder = resolve(appRoot, 'src/lib/server/db/migrations');
console.log(`[entrypoint] applying migrations from ${migrationsFolder}`);
migrate(db, { migrationsFolder });
console.log('[entrypoint] migrations applied');
raw.close();

const serverEntry = pathToFileURL(resolve(appRoot, 'build/index.js')).href;
console.log(`[entrypoint] starting server: ${serverEntry}`);
await import(serverEntry);
