import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { athletes, gear, type ActivityInsert } from '../db/schema';
import { upsertGear, discoverHistoricalGearIds } from '../repos/gear';
import {
	upsertSummary,
	applyDetail,
	activitiesNeedingDetail,
	maxStartDate,
	relinkOrphanedActivities,
	upsertActivityStream
} from '../repos/activities';
import { setLastSyncedAt, setFullBackfillAt, getSyncState } from '../repos/sync-state';
import { StravaClient } from './client';
import {
	StravaRateLimitError,
	type StravaSummaryActivity,
	type StravaDetailedActivity,
	type StravaAthlete,
	type StreamKey
} from './types';
import { eq } from 'drizzle-orm';

type DB = BetterSQLite3Database<typeof schema>;

export type SyncSummariesResult = {
	pages: number;
	upserted: number;
	maxStartDate: number | null;
};

export type EnrichResult = {
	requested: number;
	enriched: number;
	rateLimited: boolean;
};

function isoToEpoch(iso: string): number {
	return Math.floor(new Date(iso).getTime() / 1000);
}

function summaryToInsert(a: StravaSummaryActivity, athleteId: number, now: number): ActivityInsert {
	return {
		id: a.id,
		athlete_id: athleteId,
		name: a.name,
		sport_type: a.sport_type,
		type: a.type,
		start_date: isoToEpoch(a.start_date),
		start_date_local: isoToEpoch(a.start_date_local),
		timezone: a.timezone ?? null,
		utc_offset: a.utc_offset ?? null,
		distance_m: a.distance,
		moving_time_s: a.moving_time,
		elapsed_time_s: a.elapsed_time,
		total_elevation_gain_m: a.total_elevation_gain ?? 0,
		elev_high_m: a.elev_high ?? null,
		elev_low_m: a.elev_low ?? null,
		gear_id: a.gear_id ?? null,
		trainer: a.trainer ? 1 : 0,
		commute: a.commute ? 1 : 0,
		manual: a.manual ? 1 : 0,
		private: a.private ? 1 : 0,
		average_speed: a.average_speed ?? null,
		max_speed: a.max_speed ?? null,
		average_watts: a.average_watts ?? null,
		weighted_average_watts: a.weighted_average_watts ?? null,
		max_watts: a.max_watts ?? null,
		kilojoules: a.kilojoules ?? null,
		device_watts: a.device_watts ? 1 : 0,
		average_cadence: a.average_cadence ?? null,
		has_heartrate: a.has_heartrate ? 1 : 0,
		average_heartrate: a.average_heartrate ?? null,
		max_heartrate: a.max_heartrate ?? null,
		suffer_score: a.suffer_score ?? null,
		summary_polyline: a.map?.summary_polyline ?? null,
		start_lat: a.start_latlng?.[0] ?? null,
		start_lng: a.start_latlng?.[1] ?? null,
		end_lat: a.end_latlng?.[0] ?? null,
		end_lng: a.end_latlng?.[1] ?? null,
		raw_summary_json: JSON.stringify(a),
		created_at: now,
		updated_at: now
	};
}

/** Pulls /athlete, upserts the athlete row, and upserts every bike+shoe in one go. */
export async function syncGearAndAthlete(
	client: StravaClient,
	db: DB
): Promise<{ bikes: number; shoes: number; retiredAdded: number; relinked: number }> {
	const a = (await client.getAthlete()) as StravaAthlete;
	const now = Math.floor(Date.now() / 1000);
	const existing = db.select().from(athletes).where(eq(athletes.id, a.id)).all()[0];
	if (!existing) {
		db.insert(athletes)
			.values({
				id: a.id,
				username: a.username ?? null,
				firstname: a.firstname ?? null,
				lastname: a.lastname ?? null,
				ftp: a.ftp ?? null,
				weight_kg: a.weight ?? null,
				measurement: a.measurement_preference === 'meters' ? 'metric' : 'imperial',
				created_at: now,
				updated_at: now
			})
			.run();
	} else {
		db.update(athletes)
			.set({
				username: a.username ?? null,
				firstname: a.firstname ?? null,
				lastname: a.lastname ?? null,
				ftp: a.ftp ?? existing.ftp,
				weight_kg: a.weight ?? existing.weight_kg,
				measurement: a.measurement_preference === 'meters' ? 'metric' : 'imperial',
				updated_at: now
			})
			.where(eq(athletes.id, a.id))
			.run();
	}

	const bikes = a.bikes ?? [];
	const shoes = a.shoes ?? [];
	// /athlete returns SummaryGear (no frame_type/brand/model). Hit /gear/{id}
	// per bike to fill those in. ~one call per bike, single-shot per sync.
	for (const b of bikes) {
		const detail = await client.getGear(b.id).catch(() => null);
		upsertGear(db, {
			id: b.id,
			athlete_id: a.id,
			kind: 'bike',
			name: detail?.name ?? b.name,
			brand: detail?.brand_name ?? b.brand_name ?? null,
			model: detail?.model_name ?? b.model_name ?? null,
			frame_type: detail?.frame_type ?? b.frame_type ?? null,
			primary_flag: b.primary ? 1 : 0,
			retired: b.retired ? 1 : 0,
			distance_m: detail?.distance ?? b.distance ?? null,
			updated_at: now
		});
	}
	for (const s of shoes) {
		upsertGear(db, {
			id: s.id,
			athlete_id: a.id,
			kind: 'shoe',
			name: s.name,
			brand: s.brand_name ?? null,
			model: s.model_name ?? null,
			frame_type: null,
			primary_flag: s.primary ? 1 : 0,
			retired: s.retired ? 1 : 0,
			distance_m: s.distance ?? null,
			updated_at: now
		});
	}

	// /athlete omits retired bikes. Recover them from gear_ids referenced by
	// orphaned activities and fetch each via /gear/{id}. 404 = truly deleted;
	// skip those (PR #16's ghost cards still cover them).
	const orphanIds = discoverHistoricalGearIds(db);
	let retiredAdded = 0;
	for (const id of orphanIds) {
		const detail = await client.getGear(id).catch(() => null);
		if (!detail) continue;
		upsertGear(db, {
			id,
			athlete_id: a.id,
			kind: 'bike',
			name: detail.name ?? id,
			brand: detail.brand_name ?? null,
			model: detail.model_name ?? null,
			frame_type: detail.frame_type ?? null,
			primary_flag: 0,
			retired: 1,
			distance_m: detail.distance ?? null,
			updated_at: now
		});
		retiredAdded += 1;
	}
	const relinked = relinkOrphanedActivities(db);
	return { bikes: bikes.length, shoes: shoes.length, retiredAdded, relinked };
}

/**
 * Page through ALL activities since `after` (epoch seconds, default 0 → full backfill).
 * Idempotent — UPSERT on activity id. Returns total upserted and the max start_date seen.
 */
export async function syncSummaries(
	client: StravaClient,
	db: DB,
	athleteId: number,
	opts: { after?: number; perPage?: number } = {}
): Promise<SyncSummariesResult> {
	const after = opts.after ?? 0;
	const perPage = opts.perPage ?? 200;
	const now = Math.floor(Date.now() / 1000);
	// Strava /athlete returns only currently-owned gear, but activities can
	// reference gear_ids the user has since deleted. Null those before insert
	// so the activities.gear_id FK does not abort the whole sync.
	const knownGearIds = new Set(db.select({ id: gear.id }).from(gear).all().map((r) => r.id));
	let page = 1;
	let upserted = 0;
	let maxSeen: number | null = null;
	while (true) {
		const rows = await client.listActivities({ after, page, perPage });
		if (rows.length === 0) break;
		for (const a of rows) {
			const insert = summaryToInsert(a, athleteId, now);
			if (insert.gear_id && !knownGearIds.has(insert.gear_id)) insert.gear_id = null;
			upsertSummary(db, insert);
			const t = isoToEpoch(a.start_date);
			if (maxSeen === null || t > maxSeen) maxSeen = t;
			upserted++;
		}
		page++;
		// Strava returns up to perPage rows; less = last page.
		if (rows.length < perPage) break;
	}
	return { pages: page - 1, upserted, maxStartDate: maxSeen };
}

/**
 * Full backfill — equivalent to syncSummaries({ after: 0 }), then stamp last_full_backfill_at.
 */
export async function bootstrapSummaries(client: StravaClient, db: DB, athleteId: number): Promise<SyncSummariesResult> {
	const r = await syncSummaries(client, db, athleteId, { after: 0 });
	const now = Math.floor(Date.now() / 1000);
	setFullBackfillAt(db, now);
	if (r.maxStartDate !== null) setLastSyncedAt(db, now, r.maxStartDate);
	else setLastSyncedAt(db, now);
	return r;
}

/**
 * Incremental sync — uses sync_state.last_after_epoch (or the DB-observed max start_date,
 * whichever is later) as the `after` cursor.
 */
export async function syncIncremental(client: StravaClient, db: DB, athleteId: number): Promise<SyncSummariesResult> {
	const state = getSyncState(db);
	const dbMax = maxStartDate(db) ?? 0;
	const after = Math.max(state?.last_after_epoch ?? 0, dbMax);
	const r = await syncSummaries(client, db, athleteId, { after });
	const now = Math.floor(Date.now() / 1000);
	setLastSyncedAt(db, now, r.maxStartDate ?? after);
	return r;
}

export const STREAM_KEYS: StreamKey[] = [
	'time',
	'distance',
	'latlng',
	'altitude',
	'velocity_smooth',
	'heartrate',
	'cadence',
	'watts',
	'temp',
	'moving',
	'grade_smooth'
];

/**
 * Fetch every available stream type for one activity and upsert one row per
 * type into `activity_streams`. Returns false if the activity is unknown
 * locally; Strava omits keys it doesn't have data for, so `types` may be
 * smaller than STREAM_KEYS.length.
 */
export async function enrichStreams(
	client: StravaClient,
	db: DB,
	id: number
): Promise<{ enriched: boolean; types: number }> {
	const exists = db.select().from(schema.activities).where(eq(schema.activities.id, id)).all()[0];
	if (!exists) return { enriched: false, types: 0 };
	const streams = await client.getStreams(id, STREAM_KEYS);
	const now = Math.floor(Date.now() / 1000);
	let types = 0;
	for (const [type, s] of Object.entries(streams)) {
		if (!s || typeof s !== 'object') continue;
		const stream = s as { data?: unknown; resolution?: string; original_size?: number };
		if (stream.data === undefined) continue;
		upsertActivityStream(db, {
			activity_id: id,
			type,
			data_json: JSON.stringify(stream.data),
			resolution: stream.resolution ?? 'high',
			original_size: stream.original_size ?? (Array.isArray(stream.data) ? stream.data.length : 0),
			fetched_at: now
		});
		types++;
	}
	return { enriched: true, types };
}

/**
 * Fetch DetailedActivity for one specific activity by id. Used by the
 * `/api/activities/{id}/enrich` endpoint so the detail page can pull a
 * single ride without detouring to Settings. Returns false if the activity
 * is unknown locally; throws StravaRateLimitError / StravaAuthError on API
 * trouble (handler maps to 429 / 401).
 */
export async function enrichOne(
	client: StravaClient,
	db: DB,
	id: number
): Promise<{ enriched: boolean }> {
	const exists = db.select().from(schema.activities).where(eq(schema.activities.id, id)).all()[0];
	if (!exists) return { enriched: false };
	const detail = (await client.getActivity(id)) as StravaDetailedActivity;
	const now = Math.floor(Date.now() / 1000);
	applyDetail(
		db,
		id,
		{
			calories: detail.calories ?? null,
			device_watts: detail.device_watts ? 1 : 0,
			max_watts: detail.max_watts ?? null,
			weighted_average_watts: detail.weighted_average_watts ?? null,
			kilojoules: detail.kilojoules ?? null,
			suffer_score: detail.suffer_score ?? null,
			raw_detail_json: JSON.stringify(detail)
		},
		now
	);
	return { enriched: true };
}

/**
 * Fetch DetailedActivity for the next `limit` activities lacking detail. Bails on rate-limit.
 */
export async function enrichDetail(client: StravaClient, db: DB, limit: number): Promise<EnrichResult> {
	const rows = activitiesNeedingDetail(db, limit);
	const now = Math.floor(Date.now() / 1000);
	let enriched = 0;
	for (const row of rows) {
		try {
			const detail = (await client.getActivity(row.id)) as StravaDetailedActivity;
			applyDetail(
				db,
				row.id,
				{
					calories: detail.calories ?? null,
					device_watts: detail.device_watts ? 1 : 0,
					max_watts: detail.max_watts ?? null,
					weighted_average_watts: detail.weighted_average_watts ?? null,
					kilojoules: detail.kilojoules ?? null,
					suffer_score: detail.suffer_score ?? null,
					raw_detail_json: JSON.stringify(detail)
				},
				now
			);
			enriched++;
		} catch (e) {
			if (e instanceof StravaRateLimitError) {
				return { requested: rows.length, enriched, rateLimited: true };
			}
			throw e;
		}
	}
	return { requested: rows.length, enriched, rateLimited: false };
}
