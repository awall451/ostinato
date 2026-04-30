import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDb } from '../src/lib/server/db/index';

const { db } = getDb();
migrate(db, { migrationsFolder: './src/lib/server/db/migrations' });
console.log('migrations applied');
