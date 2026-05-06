import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { athletes, gear, activities } from '../db/schema';
import { syncSummaries, syncGearAndAthlete, enrichOne, enrichStreams } from './sync';
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

describe('syncGearAndAthlete — retired-bike discovery and relink', () => {
	it('fetches /gear/{id} for orphan ids in raw_summary_json and relinks activities', async () => {
		const now = Math.floor(Date.now() / 1000);
		// Orphan ride: gear_id NULL but raw payload references a bike that /athlete will not return.
		db.insert(activities)
			.values({
				id: 9001,
				athlete_id: 1,
				name: 'old',
				sport_type: 'Ride',
				start_date: now,
				start_date_local: now,
				distance_m: 1000,
				moving_time_s: 100,
				elapsed_time_s: 100,
				total_elevation_gain_m: 0,
				gear_id: null,
				raw_summary_json: JSON.stringify({ gear_id: 'b_retired' }),
				has_heartrate: 0,
				created_at: now,
				updated_at: now
			})
			.run();

		const athlete: StravaAthlete = {
			id: 1,
			username: 'd',
			firstname: null,
			lastname: null,
			measurement_preference: 'feet',
			bikes: [], // /athlete returns no active bikes
			shoes: []
		};
		const detailedById: Record<string, { id: string; name: string; frame_type: number; brand_name: string; retired: boolean }> = {
			b_retired: { id: 'b_retired', name: 'Old MTB', frame_type: 1, brand_name: 'Brand', retired: true }
		};
		const client = {
			getAthlete: async () => athlete,
			getGear: async (id: string) => detailedById[id]
		} as unknown as StravaClient;

		await syncGearAndAthlete(client, db);

		const gearRows = db.select().from(gear).all();
		const newBike = gearRows.find((g) => g.id === 'b_retired');
		expect(newBike).toBeDefined();
		expect(newBike!.frame_type).toBe(1);
		expect(newBike!.retired).toBe(1);
		expect(newBike!.name).toBe('Old MTB');

		const ride = db.select().from(activities).all();
		const r = ride.find((a) => a.id === 9001)!;
		expect(r.gear_id).toBe('b_retired');
	});
});

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

describe('enrichStreams', () => {
	function fakeStreamsClient(streams: Record<string, unknown>): StravaClient {
		return {
			getStreams: async () => streams
		} as unknown as StravaClient;
	}

	it('returns { enriched: false, types: 0 } when activity not in DB', async () => {
		const client = fakeStreamsClient({});
		const r = await enrichStreams(client, db, 999999);
		expect(r.enriched).toBe(false);
		expect(r.types).toBe(0);
	});

	it('upserts one row per stream type', async () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(activities)
			.values({
				id: 444,
				athlete_id: 1,
				name: 'r',
				sport_type: 'Ride',
				start_date: now,
				start_date_local: now,
				distance_m: 1000,
				moving_time_s: 100,
				elapsed_time_s: 100,
				total_elevation_gain_m: 0,
				has_heartrate: 0,
				created_at: now,
				updated_at: now
			})
			.run();

		const client = fakeStreamsClient({
			heartrate: { type: 'heartrate', data: [140, 145, 150], series_type: 'distance', original_size: 3, resolution: 'high' },
			watts: { type: 'watts', data: [200, 210, 220], series_type: 'distance', original_size: 3, resolution: 'high' },
			distance: { type: 'distance', data: [0, 100, 200], series_type: 'distance', original_size: 3, resolution: 'high' },
			latlng: { type: 'latlng', data: [[40.0, -105.0], [40.001, -105.001], [40.002, -105.002]], series_type: 'distance', original_size: 3, resolution: 'high' }
		});

		const r = await enrichStreams(client, db, 444);
		expect(r.enriched).toBe(true);
		expect(r.types).toBe(4);

		const rows = db.select().from(schema.activity_streams).all();
		expect(rows).toHaveLength(4);
		const byType = new Map(rows.map((row) => [row.type, row]));
		expect(byType.get('heartrate')!.original_size).toBe(3);
		expect(JSON.parse(byType.get('latlng')!.data_json)).toEqual([
			[40.0, -105.0],
			[40.001, -105.001],
			[40.002, -105.002]
		]);
	});

	it('replaces existing rows when called again (upsert by composite key)', async () => {
		const now = Math.floor(Date.now() / 1000);
		db.insert(activities)
			.values({
				id: 445,
				athlete_id: 1,
				name: 'r',
				sport_type: 'Ride',
				start_date: now,
				start_date_local: now,
				distance_m: 1000,
				moving_time_s: 100,
				elapsed_time_s: 100,
				total_elevation_gain_m: 0,
				has_heartrate: 0,
				created_at: now,
				updated_at: now
			})
			.run();
		const stream1 = fakeStreamsClient({
			heartrate: { type: 'heartrate', data: [140, 145], series_type: 'distance', original_size: 2, resolution: 'high' }
		});
		const stream2 = fakeStreamsClient({
			heartrate: { type: 'heartrate', data: [200, 210, 220], series_type: 'distance', original_size: 3, resolution: 'high' }
		});
		await enrichStreams(stream1, db, 445);
		await enrichStreams(stream2, db, 445);
		const rows = db.select().from(schema.activity_streams).all();
		expect(rows).toHaveLength(1);
		expect(JSON.parse(rows[0].data_json)).toEqual([200, 210, 220]);
		expect(rows[0].original_size).toBe(3);
	});
});

describe('enrichOne', () => {
	function fakeDetailClient(detail: Record<string, unknown>): StravaClient {
		return {
			getActivity: async (id: number) => ({ id, ...detail })
		} as unknown as StravaClient;
	}

	it('returns { enriched: false } when activity not in DB', async () => {
		const client = fakeDetailClient({ description: 'x', calories: 100 });
		const result = await enrichOne(client, db, 999999);
		expect(result.enriched).toBe(false);
	});

	it('writes raw_detail_json + applies detail-only fields', async () => {
		// Seed a summary row first.
		const now = Math.floor(Date.now() / 1000);
		db.insert(activities)
			.values({
				id: 555,
				athlete_id: 1,
				name: 'r',
				sport_type: 'Ride',
				start_date: now,
				start_date_local: now,
				distance_m: 1000,
				moving_time_s: 100,
				elapsed_time_s: 100,
				total_elevation_gain_m: 0,
				has_heartrate: 0,
				created_at: now,
				updated_at: now
			})
			.run();

		const client = fakeDetailClient({
			description: 'great ride',
			calories: 720,
			suffer_score: 42,
			weighted_average_watts: 220,
			max_watts: 850,
			kilojoules: 1230,
			splits_metric: [{ split: 1, distance: 1000, moving_time: 240, elapsed_time: 245, elevation_difference: 5, average_heartrate: 145 }]
		});

		const result = await enrichOne(client, db, 555);
		expect(result.enriched).toBe(true);

		const row = db.select().from(activities).where(eq(activities.id, 555)).all()[0];
		expect(row.detail_fetched_at).not.toBeNull();
		expect(row.calories).toBe(720);
		expect(row.suffer_score).toBe(42);
		expect(row.weighted_average_watts).toBe(220);
		expect(row.max_watts).toBe(850);
		expect(row.kilojoules).toBe(1230);
		expect(row.raw_detail_json).not.toBeNull();
		const parsed = JSON.parse(row.raw_detail_json!);
		expect(parsed.description).toBe('great ride');
		expect(parsed.splits_metric).toHaveLength(1);
	});
});
