import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { athletes, gear, activities } from '../db/schema';
import { syncSummaries } from './sync';
import type { StravaClient } from './client';
import type { StravaSummaryActivity } from './types';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const raw = new Database(':memory:');
	raw.pragma('foreign_keys = ON');
	db = drizzle(raw, { schema });
	migrate(db, { migrationsFolder: './src/lib/server/db/migrations' });
	const now = Math.floor(Date.now() / 1000);
	db.insert(athletes).values({ id: 1, measurement: 'imperial', created_at: now, updated_at: now }).run();
	db.insert(gear)
		.values({ id: 'b_known', athlete_id: 1, kind: 'bike', name: 'Known Bike', updated_at: now })
		.run();
});

function summary(id: number, gear_id: string | null = null): StravaSummaryActivity {
	return {
		id,
		athlete: { id: 1 },
		name: `ride ${id}`,
		type: 'Ride',
		sport_type: 'Ride',
		start_date: '2026-01-01T12:00:00Z',
		start_date_local: '2026-01-01T12:00:00',
		distance: 10000,
		moving_time: 1800,
		elapsed_time: 1900,
		total_elevation_gain: 100,
		gear_id,
		average_speed: 5.5,
		has_heartrate: false
	};
}

function fakeClient(rows: StravaSummaryActivity[]): StravaClient {
	let served = false;
	return {
		listActivities: async () => {
			if (served) return [];
			served = true;
			return rows;
		}
	} as unknown as StravaClient;
}

describe('syncSummaries — unknown gear_id handling', () => {
	it('does not throw when an activity references a gear_id missing from the gear table', async () => {
		const client = fakeClient([
			summary(100, 'b_known'),
			summary(101, 'b_deleted'), // not in gear table
			summary(102, null)
		]);
		await expect(syncSummaries(client, db, 1)).resolves.toBeDefined();
	});

	it('preserves activities with unknown gear_id by nulling the FK', async () => {
		const client = fakeClient([
			summary(100, 'b_known'),
			summary(101, 'b_deleted'),
			summary(102, null)
		]);
		await syncSummaries(client, db, 1);
		const rows = db.select().from(activities).all();
		expect(rows).toHaveLength(3);
		const byId = new Map(rows.map((r) => [r.id, r]));
		expect(byId.get(100)!.gear_id).toBe('b_known');
		expect(byId.get(101)!.gear_id).toBeNull();
		expect(byId.get(102)!.gear_id).toBeNull();
	});
});
