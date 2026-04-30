import { getDb } from '../src/lib/server/db/index';
import { seedFixtures } from '../src/lib/server/seed';

const { db } = getDb();
const report = seedFixtures(db, { count: 150, seed: 42 });
console.log('seed report:', report);
