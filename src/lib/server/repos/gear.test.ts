import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { athletes, gear } from '../db/schema';
import { upsertSummary } from './activities';
import { totalsByGear, listGear, upsertGear, deletedBikeTotals } from './gear';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const raw = new Database(':memory:');
	raw.pragma('foreign_keys = ON');
	db = drizzle(raw, { schema });
	migrate(db, { migrationsFolder: './src/lib/server/db/migrations' });
	const now = Math.floor(Date.now() / 1000);
	db.insert(athletes).values({ id: 1, measurement: 'imperial', created_at: now, updated_at: now }).run();
	db.insert(gear)
		.values({ id: 'b1', athlete_id: 1, kind: 'bike', name: 'MTB', updated_at: now })
		.run();
	db.insert(gear)
		.values({ id: 'b2', athlete_id: 1, kind: 'bike', name: 'Road', updated_at: now })
		.run();
	db.insert(gear)
		.values({ id: 'b3', athlete_id: 1, kind: 'bike', name: 'Retired', retired: 1, updated_at: now })
		.run();
});

function ride(id: number, gearId: string, dist: number, time: number, elev: number, watts?: number, hr?: number) {
	const now = Math.floor(Date.now() / 1000);
	upsertSummary(db, {
		id,
		athlete_id: 1,
		name: `r${id}`,
		sport_type: 'Ride',
		start_date: now,
		start_date_local: now,
		distance_m: dist,
		moving_time_s: time,
		elapsed_time_s: time,
		total_elevation_gain_m: elev,
		gear_id: gearId,
		average_speed: dist / time,
		average_watts: watts ?? null,
		has_heartrate: hr ? 1 : 0,
		average_heartrate: hr ?? null,
		created_at: now,
		updated_at: now
	});
}

describe('totalsByGear', () => {
	it('sums distance/time/elev per gear and groups correctly', () => {
		ride(1, 'b1', 10000, 1800, 100);
		ride(2, 'b1', 20000, 3600, 200);
		ride(3, 'b2', 30000, 5400, 300);
		const t = totalsByGear(db);
		const m = new Map(t.map((row) => [row.gear_id, row]));
		expect(m.get('b1')!.distance_m).toBe(30000);
		expect(m.get('b1')!.moving_time_s).toBe(5400);
		expect(m.get('b1')!.elev_m).toBe(300);
		expect(m.get('b1')!.count).toBe(2);
		expect(m.get('b2')!.distance_m).toBe(30000);
		expect(m.get('b2')!.count).toBe(1);
	});

	it('AVGs only present values for power and HR', () => {
		ride(1, 'b1', 10000, 1800, 100, 200, 150);
		ride(2, 'b1', 10000, 1800, 100, undefined, 160); // no watts
		ride(3, 'b1', 10000, 1800, 100, 220, undefined); // no HR
		const t = totalsByGear(db);
		const b1 = t.find((r) => r.gear_id === 'b1')!;
		// SQLite AVG ignores NULLs → avg of [200, 220] = 210, avg of [150, 160] = 155
		expect(b1.avg_watts).toBe(210);
		expect(b1.avg_heartrate).toBe(155);
	});

	it('excludes activities with null gear_id', () => {
		ride(1, 'b1', 10000, 1800, 100);
		// activity with no gear
		const now = Math.floor(Date.now() / 1000);
		upsertSummary(db, {
			id: 2,
			athlete_id: 1,
			name: 'no-gear',
			sport_type: 'Ride',
			start_date: now,
			start_date_local: now,
			distance_m: 99999,
			moving_time_s: 1800,
			elapsed_time_s: 1800,
			total_elevation_gain_m: 0,
			gear_id: null,
			average_speed: 5,
			has_heartrate: 0,
			created_at: now,
			updated_at: now
		});
		const t = totalsByGear(db);
		expect(t.length).toBe(1);
		expect(t[0].gear_id).toBe('b1');
	});
});

describe('deletedBikeTotals', () => {
	function orphanRide(id: number, rawGearId: string | null, dist: number, time: number, elev: number) {
		const now = Math.floor(Date.now() / 1000);
		upsertSummary(db, {
			id,
			athlete_id: 1,
			name: `r${id}`,
			sport_type: 'Ride',
			start_date: now,
			start_date_local: now,
			distance_m: dist,
			moving_time_s: time,
			elapsed_time_s: time,
			total_elevation_gain_m: elev,
			gear_id: null, // PR #9 nulled the FK
			raw_summary_json: JSON.stringify({ gear_id: rawGearId }),
			average_speed: dist / time,
			has_heartrate: 0,
			created_at: now,
			updated_at: now
		});
	}

	it('aggregates rides whose original gear is no longer in the gear table', () => {
		orphanRide(101, 'b_deleted_a', 10000, 1800, 100);
		orphanRide(102, 'b_deleted_a', 20000, 3600, 200);
		orphanRide(103, 'b_deleted_b', 30000, 5400, 300);
		const rows = deletedBikeTotals(db);
		const m = new Map(rows.map((r) => [r.raw_gear_id, r]));
		expect(rows.length).toBe(2);
		expect(m.get('b_deleted_a')!.distance_m).toBe(30000);
		expect(m.get('b_deleted_a')!.count).toBe(2);
		expect(m.get('b_deleted_a')!.moving_time_s).toBe(5400);
		expect(m.get('b_deleted_a')!.elev_m).toBe(300);
		expect(m.get('b_deleted_b')!.distance_m).toBe(30000);
	});

	it('excludes rides with null raw gear_id', () => {
		orphanRide(101, 'b_deleted', 10000, 1800, 100);
		orphanRide(102, null, 20000, 3600, 200);
		const rows = deletedBikeTotals(db);
		expect(rows.map((r) => r.raw_gear_id)).toEqual(['b_deleted']);
	});

	it('excludes shoes (raw gear_id starts with g)', () => {
		orphanRide(101, 'b_deleted', 10000, 1800, 100);
		orphanRide(102, 'g_old_shoe', 20000, 3600, 200);
		const rows = deletedBikeTotals(db);
		expect(rows.map((r) => r.raw_gear_id)).toEqual(['b_deleted']);
	});

	it('excludes raw gear_ids that still exist in the gear table', () => {
		// b1 is still owned. Even if some odd row has gear_id NULL but raw points to b1,
		// the bike isn't deleted, so don't surface it as a ghost.
		orphanRide(101, 'b1', 10000, 1800, 100);
		orphanRide(102, 'b_deleted', 20000, 3600, 200);
		const rows = deletedBikeTotals(db);
		expect(rows.map((r) => r.raw_gear_id)).toEqual(['b_deleted']);
	});
});

describe('listGear', () => {
	it('hides retired by default', () => {
		const list = listGear(db);
		expect(list.map((g) => g.id).sort()).toEqual(['b1', 'b2']);
	});
	it('includes retired when asked', () => {
		const list = listGear(db, { includeRetired: true });
		expect(list.length).toBe(3);
	});
	it('filters by kind', () => {
		const now = Math.floor(Date.now() / 1000);
		upsertGear(db, { id: 's1', athlete_id: 1, kind: 'shoe', name: 'Hokas', updated_at: now });
		expect(listGear(db, { kind: 'shoe' }).map((g) => g.id)).toEqual(['s1']);
		expect(listGear(db, { kind: 'bike' }).map((g) => g.id).sort()).toEqual(['b1', 'b2']);
	});
});
