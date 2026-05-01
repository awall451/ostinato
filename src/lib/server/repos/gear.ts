import { sql, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gear, activities, type Gear } from '../db/schema';
import * as schema from '../db/schema';

type DB = BetterSQLite3Database<typeof schema>;

export function countGear(db: DB): number {
	const r = db.select({ c: sql<number>`count(*)` }).from(gear).all();
	return r[0]?.c ?? 0;
}

export function listGear(db: DB, opts: { kind?: 'bike' | 'shoe'; includeRetired?: boolean } = {}): Gear[] {
	const conds = [];
	if (opts.kind) conds.push(eq(gear.kind, opts.kind));
	if (!opts.includeRetired) conds.push(eq(gear.retired, 0));
	const q = db.select().from(gear);
	if (conds.length === 0) return q.all();
	if (conds.length === 1) return q.where(conds[0]).all();
	return q.where(sql`${conds[0]} AND ${conds[1]}`).all();
}

export function getGearById(db: DB, id: string): Gear | null {
	const r = db.select().from(gear).where(eq(gear.id, id)).all();
	return r[0] ?? null;
}

export type GearTotals = {
	gear_id: string;
	count: number;
	distance_m: number;
	moving_time_s: number;
	elev_m: number;
	avg_speed: number | null;
	avg_watts: number | null;
	avg_cadence: number | null;
	avg_heartrate: number | null;
};

/**
 * SUM totals + AVGs (weighted by activity count where data is present).
 * NULL-aware AVGs use FILTER WHERE x IS NOT NULL semantics, expressed as
 * `AVG(CASE WHEN x IS NOT NULL THEN x END)` for portability.
 */
export function totalsByGear(db: DB): GearTotals[] {
	const rows = db
		.select({
			gear_id: activities.gear_id,
			count: sql<number>`count(*)`,
			distance_m: sql<number>`coalesce(sum(${activities.distance_m}), 0)`,
			moving_time_s: sql<number>`coalesce(sum(${activities.moving_time_s}), 0)`,
			elev_m: sql<number>`coalesce(sum(${activities.total_elevation_gain_m}), 0)`,
			avg_speed: sql<number | null>`avg(${activities.average_speed})`,
			avg_watts: sql<number | null>`avg(${activities.average_watts})`,
			avg_cadence: sql<number | null>`avg(${activities.average_cadence})`,
			avg_heartrate: sql<number | null>`avg(${activities.average_heartrate})`
		})
		.from(activities)
		.where(sql`${activities.gear_id} IS NOT NULL`)
		.groupBy(activities.gear_id)
		.all();
	return rows
		.filter((r): r is GearTotals & { gear_id: string } => r.gear_id !== null)
		.map((r) => r as GearTotals);
}

export type DeletedBikeTotals = {
	raw_gear_id: string;
	count: number;
	distance_m: number;
	moving_time_s: number;
	elev_m: number;
};

// Bikes deleted on Strava: the activity's gear_id FK was nulled by syncSummaries
// (PR #9), but raw_summary_json preserves the original gear_id. Strava bike ids
// start with 'b'; shoes start with 'g'.
export function deletedBikeTotals(_db: DB): DeletedBikeTotals[] {
	return [];
}

export function upsertGear(db: DB, row: typeof gear.$inferInsert): void {
	db.insert(gear)
		.values(row)
		.onConflictDoUpdate({
			target: gear.id,
			set: {
				athlete_id: row.athlete_id,
				kind: row.kind,
				name: row.name,
				brand: row.brand ?? null,
				model: row.model ?? null,
				frame_type: row.frame_type ?? null,
				primary_flag: row.primary_flag ?? 0,
				retired: row.retired ?? 0,
				distance_m: row.distance_m ?? null,
				updated_at: row.updated_at
			}
		})
		.run();
}
