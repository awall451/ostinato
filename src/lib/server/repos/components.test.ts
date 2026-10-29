import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';
import { athletes, gear, components } from '../db/schema';
import { upsertSummary } from './activities';
import {
	addComponent,
	componentDistances,
	deleteComponent,
	installComponent,
	listComponentsForGear,
	listSpares,
	removeComponent,
	swapComponent,
	updateComponent
} from './components';

let db: BetterSQLite3Database<typeof schema>;

const day = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000;

beforeEach(() => {
	const raw = new Database(':memory:');
	raw.pragma('foreign_keys = ON');
	db = drizzle(raw, { schema });
	migrate(db, { migrationsFolder: './src/lib/server/db/migrations' });
	const now = Math.floor(Date.now() / 1000);
	db.insert(athletes).values({ id: 1, measurement: 'imperial', created_at: now, updated_at: now }).run();
	for (const id of ['b1', 'b2']) {
		db.insert(gear).values({ id, athlete_id: 1, kind: 'bike', name: id, updated_at: now }).run();
	}
});

let nextId = 1;
/** Ride at local `startLocal` (+ 8h so it's mid-day, not midnight). */
function ride(gearId: string | null, startLocal: number, dist: number, opts: { trainer?: boolean; sport?: string } = {}) {
	const now = Math.floor(Date.now() / 1000);
	upsertSummary(db, {
		id: nextId++,
		athlete_id: 1,
		name: 'r',
		sport_type: opts.sport ?? 'Ride',
		start_date: startLocal + 8 * 3600 + 4 * 3600, // UTC = local + offset; irrelevant to intervals
		start_date_local: startLocal + 8 * 3600,
		distance_m: dist,
		moving_time_s: 3600,
		elapsed_time_s: 3600,
		total_elevation_gain_m: 0,
		gear_id: gearId,
		trainer: opts.trainer ? 1 : 0,
		created_at: now,
		updated_at: now
	});
}

describe('componentDistances', () => {
	it('backdated install picks up historical rides, ignores rides before it and on other bikes', () => {
		ride('b1', day(2025, 5, 31), 1000); // before install
		ride('b1', day(2025, 6, 1), 2000); // install day → counts
		ride('b1', day(2025, 7, 1), 3000);
		ride('b2', day(2025, 7, 1), 9999); // other bike
		ride(null, day(2025, 7, 1), 9999); // no gear
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		expect(componentDistances(db).get(id)).toBe(5000);
	});

	it('adds starting_distance_m offset (used parts) and returns offset for parts with no rides', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain', starting_distance_m: 500 });
		expect(componentDistances(db).get(id)).toBe(500);
		ride('b1', day(2025, 6, 2), 1000);
		expect(componentDistances(db).get(id)).toBe(1500);
	});

	it('count_trainer=0 excludes trainer and VirtualRide activities', () => {
		ride('b1', day(2025, 6, 2), 1000);
		ride('b1', day(2025, 6, 3), 2000, { trainer: true });
		ride('b1', day(2025, 6, 4), 4000, { sport: 'VirtualRide' });
		const tire = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'tire_rear', count_trainer: 0 });
		const chain = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain', count_trainer: 1 });
		const d = componentDistances(db);
		expect(d.get(tire)).toBe(1000);
		expect(d.get(chain)).toBe(7000);
	});

	it('sums across bikes when a part moves (wheelset)', () => {
		ride('b1', day(2025, 6, 2), 1000);
		ride('b2', day(2025, 6, 2), 5000); // b2 before the move → no
		ride('b1', day(2025, 7, 2), 7000); // b1 after the move → no
		ride('b2', day(2025, 7, 2), 2000);
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'wheelset' });
		removeComponent(db, id, day(2025, 7, 1), { retire: false });
		installComponent(db, id, 'b2', day(2025, 7, 1));
		expect(componentDistances(db).get(id)).toBe(3000);
	});

	it('filters by ids when given', () => {
		const a = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		const b = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'cassette' });
		const d = componentDistances(db, [a]);
		expect(d.has(a)).toBe(true);
		expect(d.has(b)).toBe(false);
	});
});

describe('swapComponent', () => {
	it('closes the old install, retires it, opens the new one; swap-day ride goes to the new part', () => {
		ride('b1', day(2025, 6, 10), 1000);
		ride('b1', day(2025, 7, 1), 2000); // swap day
		ride('b1', day(2025, 7, 5), 4000);
		const old = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain', wear_limit_m: 3000 });
		const neu = swapComponent(db, old, day(2025, 7, 1), { kind: 'chain', brand: 'KMC' });
		const d = componentDistances(db);
		expect(d.get(old)).toBe(1000);
		expect(d.get(neu)).toBe(6000);

		const { installed, history } = listComponentsForGear(db, 'b1');
		expect(installed.map((c) => c.id)).toEqual([neu]);
		expect(installed[0].brand).toBe('KMC');
		expect(installed[0].distance_m).toBe(6000);
		expect(history.map((c) => c.id)).toEqual([old]);
		expect(history[0].retired).toBe(1);
		expect(history[0].removed_at).toBe(day(2025, 7, 1));
	});

	it('rejects swapping a part that is not installed', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		removeComponent(db, id, day(2025, 7, 1), { retire: true });
		expect(() => swapComponent(db, id, day(2025, 8, 1), { kind: 'chain' })).toThrow();
	});
});

describe('install / remove guards', () => {
	it('cannot install a part that is already installed', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'wheelset' });
		expect(() => installComponent(db, id, 'b2', day(2025, 7, 1))).toThrow();
	});

	it('cannot remove before the install date', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		expect(() => removeComponent(db, id, day(2025, 5, 1), { retire: true })).toThrow();
	});

	it('cannot reinstall overlapping a previous interval', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'wheelset' });
		removeComponent(db, id, day(2025, 7, 1), { retire: false });
		expect(() => installComponent(db, id, 'b2', day(2025, 6, 15))).toThrow();
	});
});

describe('listSpares', () => {
	it('returns parts removed without retiring; excludes installed and retired', () => {
		const spare = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'wheelset' });
		const dead = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		addComponent(db, 'b1', day(2025, 6, 1), { kind: 'cassette' });
		removeComponent(db, spare, day(2025, 7, 1), { retire: false });
		removeComponent(db, dead, day(2025, 7, 1), { retire: true });
		expect(listSpares(db, 1).map((c) => c.id)).toEqual([spare]);
	});
});

describe('update / delete', () => {
	it('updates editable fields', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		updateComponent(db, id, { brand: 'Shimano', model: 'CN-M8100', wear_limit_m: 3218, count_trainer: 0 });
		const row = listComponentsForGear(db, 'b1').installed[0];
		expect(row.brand).toBe('Shimano');
		expect(row.model).toBe('CN-M8100');
		expect(row.wear_limit_m).toBe(3218);
		expect(row.count_trainer).toBe(0);
	});

	it('delete removes the component and its installs', () => {
		const id = addComponent(db, 'b1', day(2025, 6, 1), { kind: 'chain' });
		deleteComponent(db, id);
		expect(db.select().from(components).all()).toHaveLength(0);
		expect(listComponentsForGear(db, 'b1')).toEqual({ installed: [], history: [] });
	});
});
