import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { athletes, gear, activities } from '../db/schema';
import { upsertSummary, applyDetail, countActivities, activitiesNeedingDetail, getActivityById } from './activities';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const raw = new Database(':memory:');
	raw.pragma('foreign_keys = ON');
	db = drizzle(raw, { schema });
	migrate(db, { migrationsFolder: './src/lib/server/db/migrations' });
	const now = Math.floor(Date.now() / 1000);
	db.insert(athletes).values({ id: 1, measurement: 'imperial', created_at: now, updated_at: now }).run();
	db.insert(gear)
		.values({ id: 'b1', athlete_id: 1, kind: 'bike', name: 'Test Bike', updated_at: now })
		.run();
});

function summary(id: number, overrides: Partial<typeof activities.$inferInsert> = {}) {
	const now = Math.floor(Date.now() / 1000);
	return {
		id,
		athlete_id: 1,
		name: `ride ${id}`,
		sport_type: 'Ride',
		start_date: now,
		start_date_local: now,
		distance_m: 10000,
		moving_time_s: 1800,
		elapsed_time_s: 1900,
		total_elevation_gain_m: 100,
		gear_id: 'b1',
		average_speed: 5.5,
		has_heartrate: 1,
		average_heartrate: 150,
		created_at: now,
		updated_at: now,
		...overrides
	} satisfies typeof activities.$inferInsert;
}

describe('upsertSummary', () => {
	it('inserts a new row', () => {
		upsertSummary(db, summary(100));
		expect(countActivities(db)).toBe(1);
	});

	it('is idempotent on the same id', () => {
		upsertSummary(db, summary(100));
		upsertSummary(db, summary(100));
		upsertSummary(db, summary(100));
		expect(countActivities(db)).toBe(1);
	});

	it('updates fields on conflict', () => {
		upsertSummary(db, summary(100, { name: 'first', distance_m: 1000 }));
		upsertSummary(db, summary(100, { name: 'second', distance_m: 2000 }));
		const row = db.select().from(activities).all()[0];
		expect(row.name).toBe('second');
		expect(row.distance_m).toBe(2000);
	});

	it('does NOT clear detail_fetched_at on summary upsert', () => {
		upsertSummary(db, summary(100));
		const now = Math.floor(Date.now() / 1000);
		applyDetail(db, 100, { calories: 500, suffer_score: 42 }, now);
		// Re-upsert summary (simulates incremental sync coming through after enrichment)
		upsertSummary(db, summary(100, { name: 'updated name' }));
		const row = db.select().from(activities).all()[0];
		expect(row.name).toBe('updated name'); // summary fields refreshed
		expect(row.detail_fetched_at).toBe(now); // detail timestamp preserved
		expect(row.calories).toBe(500); // detail field preserved
		expect(row.suffer_score).toBe(42);
	});

	it('getActivityById returns the row when present', () => {
		upsertSummary(db, summary(100, { name: 'specific ride' }));
		const got = getActivityById(db, 100);
		expect(got).not.toBeNull();
		expect(got?.id).toBe(100);
		expect(got?.name).toBe('specific ride');
	});

	it('getActivityById returns null when missing', () => {
		expect(getActivityById(db, 999)).toBeNull();
	});

	it('activitiesNeedingDetail picks only summary-only rows', () => {
		upsertSummary(db, summary(100));
		upsertSummary(db, summary(101));
		upsertSummary(db, summary(102));
		applyDetail(db, 101, { calories: 200 }, Math.floor(Date.now() / 1000));
		const need = activitiesNeedingDetail(db, 10);
		expect(need.map((r) => r.id).sort()).toEqual([100, 102]);
	});
});
