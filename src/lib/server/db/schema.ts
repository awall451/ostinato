import { sqliteTable, integer, real, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Schema is intentionally Postgres-portable:
 *  - booleans stored as INTEGER (0/1)
 *  - timestamps stored as INTEGER epoch seconds (UTC)
 *  - distances in meters, times in seconds, speeds in m/s (Strava native)
 */

export const athletes = sqliteTable('athletes', {
	id: integer('id').primaryKey(), // Strava athlete id
	username: text('username'),
	firstname: text('firstname'),
	lastname: text('lastname'),
	ftp: integer('ftp'),
	weight_kg: real('weight_kg'),
	measurement: text('measurement').notNull().default('imperial'),
	created_at: integer('created_at').notNull(),
	updated_at: integer('updated_at').notNull()
});

export const gear = sqliteTable(
	'gear',
	{
		id: text('id').primaryKey(), // Strava gear id ("b1234567" / "g7654321")
		athlete_id: integer('athlete_id')
			.notNull()
			.references(() => athletes.id),
		kind: text('kind').notNull(), // 'bike' | 'shoe'
		name: text('name').notNull(),
		brand: text('brand'),
		model: text('model'),
		// Strava frame_type: 1 mtb, 2 cross, 3 road, 4 timetrial, 5 gravel
		frame_type: integer('frame_type'),
		primary_flag: integer('primary_flag').notNull().default(0),
		retired: integer('retired').notNull().default(0),
		distance_m: real('distance_m'), // Strava-reported lifetime
		updated_at: integer('updated_at').notNull()
	},
	(t) => [index('idx_gear_kind').on(t.kind)]
);

export const activities = sqliteTable(
	'activities',
	{
		id: integer('id').primaryKey(), // Strava activity id
		athlete_id: integer('athlete_id')
			.notNull()
			.references(() => athletes.id),
		name: text('name').notNull(),
		sport_type: text('sport_type').notNull(),
		type: text('type'), // legacy
		start_date: integer('start_date').notNull(), // epoch seconds, UTC
		start_date_local: integer('start_date_local').notNull(),
		timezone: text('timezone'),
		utc_offset: integer('utc_offset'),
		distance_m: real('distance_m').notNull(),
		moving_time_s: integer('moving_time_s').notNull(),
		elapsed_time_s: integer('elapsed_time_s').notNull(),
		total_elevation_gain_m: real('total_elevation_gain_m').notNull().default(0),
		elev_high_m: real('elev_high_m'),
		elev_low_m: real('elev_low_m'),
		gear_id: text('gear_id').references(() => gear.id),
		trainer: integer('trainer').notNull().default(0),
		commute: integer('commute').notNull().default(0),
		manual: integer('manual').notNull().default(0),
		private: integer('private').notNull().default(0),
		// speed / power / cadence / hr
		average_speed: real('average_speed'),
		max_speed: real('max_speed'),
		average_watts: real('average_watts'),
		weighted_average_watts: integer('weighted_average_watts'),
		max_watts: integer('max_watts'),
		kilojoules: real('kilojoules'),
		device_watts: integer('device_watts'),
		average_cadence: real('average_cadence'),
		has_heartrate: integer('has_heartrate').notNull().default(0),
		average_heartrate: real('average_heartrate'),
		max_heartrate: real('max_heartrate'),
		suffer_score: integer('suffer_score'),
		calories: real('calories'), // detail only
		// map
		summary_polyline: text('summary_polyline'),
		start_lat: real('start_lat'),
		start_lng: real('start_lng'),
		end_lat: real('end_lat'),
		end_lng: real('end_lng'),
		// bookkeeping
		detail_fetched_at: integer('detail_fetched_at'), // NULL = summary-only
		raw_summary_json: text('raw_summary_json'),
		raw_detail_json: text('raw_detail_json'),
		created_at: integer('created_at').notNull(),
		updated_at: integer('updated_at').notNull()
	},
	(t) => [
		index('idx_activities_start_date').on(t.start_date),
		index('idx_activities_gear').on(t.gear_id),
		index('idx_activities_sport_date').on(t.sport_type, t.start_date),
		index('idx_activities_needs_detail')
			.on(t.detail_fetched_at)
			.where(sql`${t.detail_fetched_at} IS NULL`)
	]
);

export const sync_state = sqliteTable('sync_state', {
	id: integer('id').primaryKey(), // always 1; single-row table
	last_after_epoch: integer('last_after_epoch'),
	last_synced_at: integer('last_synced_at'),
	last_full_backfill_at: integer('last_full_backfill_at'),
	rate_limit_15min_used: integer('rate_limit_15min_used'),
	rate_limit_15min_limit: integer('rate_limit_15min_limit'),
	rate_limit_daily_used: integer('rate_limit_daily_used'),
	rate_limit_daily_limit: integer('rate_limit_daily_limit'),
	rate_limit_observed_at: integer('rate_limit_observed_at'),
	last_error: text('last_error'),
	last_error_at: integer('last_error_at')
});

export type Athlete = typeof athletes.$inferSelect;
export type Gear = typeof gear.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type ActivityInsert = typeof activities.$inferInsert;
export type SyncState = typeof sync_state.$inferSelect;
