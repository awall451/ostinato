import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { athletes, gear, activities } from '../db/schema';
import { syncSummaries, syncGearAndAthlete } from './sync';
import type { StravaClient } from './client';
import type { StravaAthlete, StravaSummaryActivity } from './types';

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

describe('syncGearAndAthlete — bike detail enrichment', () => {
	it('populates frame_type/brand/model from /gear/{id} since /athlete returns SummaryGear only', async () => {
		const athlete: StravaAthlete = {
			id: 1,
			username: 'd',
			firstname: 'D',
			lastname: 'H',
			measurement_preference: 'feet',
			bikes: [
				// Strava SummaryGear: id, primary, name, resource_state, distance — no frame_type/brand/model.
				{ id: 'b_mtb', primary: true, name: 'Ripley', resource_state: 2, distance: 1000 },
				{ id: 'b_gravel', primary: false, name: 'Stormchaser', resource_state: 2, distance: 500 }
			],
			shoes: []
		};
		const detailedById: Record<string, { id: string; frame_type: number; brand_name: string; model_name: string }> = {
			b_mtb: { id: 'b_mtb', frame_type: 1, brand_name: 'Ibis', model_name: 'Ripley AF' },
			b_gravel: { id: 'b_gravel', frame_type: 5, brand_name: 'All-City', model_name: 'Stormchaser' }
		};
		const client = {
			getAthlete: async () => athlete,
			getGear: async (id: string) => detailedById[id]
		} as unknown as StravaClient;

		await syncGearAndAthlete(client, db);

		const rows = db.select().from(gear).all();
		const byId = new Map(rows.map((r) => [r.id, r]));
		expect(byId.get('b_mtb')!.frame_type).toBe(1);
		expect(byId.get('b_mtb')!.brand).toBe('Ibis');
		expect(byId.get('b_mtb')!.model).toBe('Ripley AF');
		expect(byId.get('b_gravel')!.frame_type).toBe(5);
		expect(byId.get('b_gravel')!.brand).toBe('All-City');
	});
});

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
