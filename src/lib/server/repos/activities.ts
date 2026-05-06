import { sql, and, gte, lte, inArray, desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { activities, type ActivityInsert, type Activity } from '../db/schema';
import * as schema from '../db/schema';

type DB = BetterSQLite3Database<typeof schema>;

export function countActivities(db: DB): number {
	const r = db.select({ c: sql<number>`count(*)` }).from(activities).all();
	return r[0]?.c ?? 0;
}

export function listActivitiesInRange(
	db: DB,
	opts: { startEpoch?: number; endEpoch?: number; sportTypes?: string[] }
): Activity[] {
	const conds = [];
	if (opts.startEpoch !== undefined) conds.push(gte(activities.start_date, opts.startEpoch));
	if (opts.endEpoch !== undefined) conds.push(lte(activities.start_date, opts.endEpoch));
	if (opts.sportTypes && opts.sportTypes.length)
		conds.push(inArray(activities.sport_type, opts.sportTypes));
	const q = db.select().from(activities);
	const rows = (conds.length ? q.where(and(...conds)) : q)
		.orderBy(desc(activities.start_date))
		.all();
	return rows;
}

export function getActivityById(_db: DB, _id: number): Activity | null {
	// stub — implemented in green commit
	return null;
}

export function listActivitiesForGear(db: DB, gearId: string, limit = 200): Activity[] {
	return db
		.select()
		.from(activities)
		.where(eq(activities.gear_id, gearId))
		.orderBy(desc(activities.start_date))
		.limit(limit)
		.all();
}

export function maxStartDate(db: DB): number | null {
	const r = db
		.select({ m: sql<number | null>`max(${activities.start_date})` })
		.from(activities)
		.all();
	return r[0]?.m ?? null;
}

export function activitiesNeedingDetail(db: DB, limit: number): Activity[] {
	return db
		.select()
		.from(activities)
		.where(sql`${activities.detail_fetched_at} IS NULL`)
		.orderBy(desc(activities.start_date))
		.limit(limit)
		.all();
}

/**
 * UPSERT a SummaryActivity. Never clears detail_fetched_at (incremental sync
 * must not clobber detail enrichment). Caller passes a row with all fields
 * present in the summary payload; missing detail-only fields stay untouched
 * via the `set` clause that excludes them.
 */
export function upsertSummary(db: DB, row: ActivityInsert): void {
	db.insert(activities)
		.values(row)
		.onConflictDoUpdate({
			target: activities.id,
			set: {
				athlete_id: row.athlete_id,
				name: row.name,
				sport_type: row.sport_type,
				type: row.type ?? null,
				start_date: row.start_date,
				start_date_local: row.start_date_local,
				timezone: row.timezone ?? null,
				utc_offset: row.utc_offset ?? null,
				distance_m: row.distance_m,
				moving_time_s: row.moving_time_s,
				elapsed_time_s: row.elapsed_time_s,
				total_elevation_gain_m: row.total_elevation_gain_m,
				elev_high_m: row.elev_high_m ?? null,
				elev_low_m: row.elev_low_m ?? null,
				gear_id: row.gear_id ?? null,
				trainer: row.trainer ?? 0,
				commute: row.commute ?? 0,
				manual: row.manual ?? 0,
				private: row.private ?? 0,
				average_speed: row.average_speed ?? null,
				max_speed: row.max_speed ?? null,
				average_watts: row.average_watts ?? null,
				device_watts: row.device_watts ?? null,
				average_cadence: row.average_cadence ?? null,
				has_heartrate: row.has_heartrate ?? 0,
				average_heartrate: row.average_heartrate ?? null,
				max_heartrate: row.max_heartrate ?? null,
				summary_polyline: row.summary_polyline ?? null,
				start_lat: row.start_lat ?? null,
				start_lng: row.start_lng ?? null,
				end_lat: row.end_lat ?? null,
				end_lng: row.end_lng ?? null,
				raw_summary_json: row.raw_summary_json ?? null,
				updated_at: row.updated_at
				// NB: detail-only fields intentionally NOT in SET clause:
				// detail_fetched_at, calories, raw_detail_json,
				// suffer_score, weighted_average_watts, max_watts, kilojoules
				// — these are populated by enrichDetail and preserved on summary re-upsert.
			}
		})
		.run();
}

// Restore gear_id on activities whose FK was nulled by syncSummaries (PR #9)
// when the original gear_id (preserved in raw_summary_json) now matches a row
// in the gear table — typically because syncGearAndAthlete just upserted the
// retired bike. Returns rows updated.
export function relinkOrphanedActivities(db: DB): number {
	const rawGearId = sql`json_extract(${activities.raw_summary_json}, '$.gear_id')`;
	const result = db.run(sql`
		UPDATE ${activities}
		SET gear_id = ${rawGearId}, updated_at = CAST(strftime('%s','now') AS INTEGER)
		WHERE ${activities.gear_id} IS NULL
			AND ${activities.raw_summary_json} IS NOT NULL
			AND ${rawGearId} IS NOT NULL
			AND ${rawGearId} IN (SELECT id FROM gear)
	`);
	return Number(result.changes ?? 0);
}

/** Apply detail-only fields and stamp detail_fetched_at. */
export function applyDetail(
	db: DB,
	id: number,
	patch: {
		calories?: number | null;
		device_watts?: number | null;
		max_watts?: number | null;
		weighted_average_watts?: number | null;
		kilojoules?: number | null;
		suffer_score?: number | null;
		raw_detail_json?: string | null;
	},
	now: number
): void {
	db.update(activities)
		.set({ ...patch, detail_fetched_at: now, updated_at: now })
		.where(eq(activities.id, id))
		.run();
}
