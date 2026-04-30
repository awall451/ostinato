import type { Database } from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Locals {
			db: BetterSQLite3Database<typeof schema>;
			rawDb: Database;
		}
	}
}

export {};
