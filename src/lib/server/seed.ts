import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { athletes, gear, activities, sync_state } from './db/schema';
import * as schema from './db/schema';
import { sql } from 'drizzle-orm';
import { upsertGear } from './repos/gear';
import { upsertSummary, applyDetail } from './repos/activities';

type DB = BetterSQLite3Database<typeof schema>;

/** Mulberry32 PRNG — small, deterministic, good enough for fixtures. */
function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(r: () => number, items: readonly T[]): T {
	return items[Math.floor(r() * items.length)];
}

function jitter(r: () => number, base: number, frac: number): number {
	return base * (1 + (r() * 2 - 1) * frac);
}

const ATHLETE_ID = 1;

const BIKES = [
	{
		id: 'b_mtb_1',
		name: 'Trail MTB',
		brand: 'Santa Cruz',
		model: 'Hightower',
		frame_type: 1,
		primary_flag: 1
	},
	{ id: 'b_gravel_1', name: 'Gravel Slayer', brand: 'Specialized', model: 'Diverge', frame_type: 5, primary_flag: 0 },
	{ id: 'b_road_1', name: 'Road Race', brand: 'Cannondale', model: 'SuperSix EVO', frame_type: 3, primary_flag: 0 }
];

const SHOES = [{ id: 's_daily_1', name: 'Daily Trainers', brand: 'Hoka', model: 'Clifton 9', frame_type: null }];

type SportProfile = {
	sport: string;
	gearId: string | null;
	distM: [number, number]; // min, max meters
	speedMps: [number, number];
	elevPerKm: [number, number]; // m per km of distance
	watts?: [number, number];
	cadence?: [number, number];
	hr: [number, number];
};

const PROFILES: SportProfile[] = [
	// MTB: short-ish, slow, lots of climbing, no power, some HR
	{
		sport: 'MountainBikeRide',
		gearId: 'b_mtb_1',
		distM: [10_000, 35_000],
		speedMps: [3.5, 5.5],
		elevPerKm: [20, 50],
		hr: [140, 165]
	},
	// eMTB: slightly longer, more elevation, faster
	{
		sport: 'EMountainBikeRide',
		gearId: 'b_mtb_1',
		distM: [20_000, 50_000],
		speedMps: [5, 7],
		elevPerKm: [25, 60],
		hr: [125, 150]
	},
	// Gravel: mid-distance, moderate speed
	{
		sport: 'GravelRide',
		gearId: 'b_gravel_1',
		distM: [40_000, 90_000],
		speedMps: [6, 8],
		elevPerKm: [10, 25],
		watts: [180, 240],
		cadence: [80, 90],
		hr: [140, 160]
	},
	// Road: longer, faster, flatter
	{
		sport: 'Ride',
		gearId: 'b_road_1',
		distM: [30_000, 100_000],
		speedMps: [7, 10],
		elevPerKm: [5, 15],
		watts: [200, 260],
		cadence: [85, 95],
		hr: [145, 165]
	},
	// Run: short, slow
	{
		sport: 'Run',
		gearId: 's_daily_1',
		distM: [5_000, 12_000],
		speedMps: [2.7, 3.5],
		elevPerKm: [5, 15],
		cadence: [165, 180],
		hr: [150, 170]
	},
	// TrailRun: shorter, hillier
	{
		sport: 'TrailRun',
		gearId: 's_daily_1',
		distM: [6_000, 15_000],
		speedMps: [2.2, 3.1],
		elevPerKm: [25, 60],
		cadence: [160, 175],
		hr: [155, 175]
	}
];

const SPORT_WEIGHTS = [
	{ idx: 0, w: 40 }, // MTB
	{ idx: 1, w: 10 }, // eMTB
	{ idx: 2, w: 20 }, // Gravel
	{ idx: 3, w: 20 }, // Road
	{ idx: 4, w: 7 }, // Run
	{ idx: 5, w: 3 } // TrailRun
];

function pickSport(r: () => number): SportProfile {
	const total = SPORT_WEIGHTS.reduce((s, x) => s + x.w, 0);
	let n = r() * total;
	for (const sw of SPORT_WEIGHTS) {
		if (n < sw.w) return PROFILES[sw.idx];
		n -= sw.w;
	}
	return PROFILES[0];
}

const ACTIVITY_NAMES = [
	'Morning Ride',
	'Evening Ride',
	'Lunch Loop',
	'Coffee Spin',
	'Send Town',
	'Recovery Spin',
	'Big Day Out',
	'Tempo',
	'Z2 Endurance',
	'Hill Repeats',
	'Sufferfest',
	'Rad Sesh',
	'Easy Pedal'
];
const RUN_NAMES = ['Morning Run', 'Lunch Run', 'Trail Lap', 'Long Run', 'Recovery Jog', 'Track Workout'];

export type SeedReport = {
	athletes: number;
	gear: number;
	activities: number;
	withDetail: number;
};

export function seedFixtures(db: DB, opts: { count?: number; seed?: number } = {}): SeedReport {
	const count = opts.count ?? 150;
	const r = rng(opts.seed ?? 1);
	const now = Math.floor(Date.now() / 1000);
	const start = now - 18 * 30 * 86400; // ~18 months ago

	// Wipe in dependency order
	db.delete(activities).run();
	db.delete(gear).run();
	db.delete(athletes).run();
	db.delete(sync_state).run();

	db.insert(athletes)
		.values({
			id: ATHLETE_ID,
			username: 'fixture',
			firstname: 'Fixture',
			lastname: 'Athlete',
			ftp: 250,
			weight_kg: 75,
			measurement: 'imperial',
			created_at: now,
			updated_at: now
		})
		.run();

	for (const b of BIKES) {
		upsertGear(db, {
			id: b.id,
			athlete_id: ATHLETE_ID,
			kind: 'bike',
			name: b.name,
			brand: b.brand,
			model: b.model,
			frame_type: b.frame_type,
			primary_flag: b.primary_flag,
			retired: 0,
			distance_m: 0,
			updated_at: now
		});
	}
	for (const s of SHOES) {
		upsertGear(db, {
			id: s.id,
			athlete_id: ATHLETE_ID,
			kind: 'shoe',
			name: s.name,
			brand: s.brand,
			model: s.model,
			frame_type: s.frame_type ?? null,
			primary_flag: 0,
			retired: 0,
			distance_m: 0,
			updated_at: now
		});
	}

	let withDetail = 0;
	for (let i = 0; i < count; i++) {
		const profile = pickSport(r);
		const t = start + Math.floor(r() * (now - start));
		const dist = jitter(r, (profile.distM[0] + profile.distM[1]) / 2, 0.35);
		const speed = jitter(r, (profile.speedMps[0] + profile.speedMps[1]) / 2, 0.15);
		const moving = Math.floor(dist / speed);
		const elapsed = Math.floor(moving * (1 + r() * 0.15));
		const elevPerKm = jitter(r, (profile.elevPerKm[0] + profile.elevPerKm[1]) / 2, 0.4);
		const elev = Math.max(0, (dist / 1000) * elevPerKm);
		const isRun = profile.sport === 'Run' || profile.sport === 'TrailRun';
		const id = 1_000_000 + i;
		const hasDetail = r() < 0.7;
		const hr = profile.hr[0] + r() * (profile.hr[1] - profile.hr[0]);
		const watts =
			profile.watts !== undefined ? profile.watts[0] + r() * (profile.watts[1] - profile.watts[0]) : null;
		const cadence =
			profile.cadence !== undefined
				? profile.cadence[0] + r() * (profile.cadence[1] - profile.cadence[0])
				: null;

		upsertSummary(db, {
			id,
			athlete_id: ATHLETE_ID,
			name: pick(r, isRun ? RUN_NAMES : ACTIVITY_NAMES),
			sport_type: profile.sport,
			type: profile.sport.includes('Ride') ? 'Ride' : profile.sport.includes('Run') ? 'Run' : profile.sport,
			start_date: t,
			start_date_local: t,
			timezone: '(GMT-08:00) America/Los_Angeles',
			utc_offset: -28800,
			distance_m: dist,
			moving_time_s: moving,
			elapsed_time_s: elapsed,
			total_elevation_gain_m: elev,
			elev_high_m: 200 + r() * 800,
			elev_low_m: 100 + r() * 200,
			gear_id: profile.gearId,
			trainer: 0,
			commute: 0,
			manual: 0,
			private: 0,
			average_speed: speed,
			max_speed: speed * (1.5 + r() * 0.7),
			average_watts: watts,
			weighted_average_watts: watts !== null ? Math.round(watts * (1 + r() * 0.1)) : null,
			max_watts: watts !== null ? Math.round(watts * (2 + r() * 1.5)) : null,
			kilojoules: watts !== null ? (watts * moving) / 1000 : null,
			device_watts: watts !== null ? 1 : 0,
			average_cadence: cadence,
			has_heartrate: 1,
			average_heartrate: hr,
			max_heartrate: hr + 10 + r() * 15,
			suffer_score: hasDetail ? Math.floor(r() * 200) : null,
			summary_polyline: null,
			start_lat: 37.5 + r() * 0.5,
			start_lng: -122.5 + r() * 0.8,
			end_lat: null,
			end_lng: null,
			created_at: now,
			updated_at: now
		});

		if (hasDetail) {
			withDetail++;
			applyDetail(
				db,
				id,
				{
					calories: ((watts ?? 200) * moving) / 4184 + r() * 50,
					device_watts: watts !== null ? 1 : 0,
					max_watts: watts !== null ? Math.round(watts * (2 + r() * 1.5)) : null,
					weighted_average_watts: watts !== null ? Math.round(watts * (1 + r() * 0.1)) : null,
					kilojoules: watts !== null ? (watts * moving) / 1000 : null,
					suffer_score: Math.floor(r() * 200)
				},
				now
			);
		}
	}

	db.insert(sync_state).values({ id: 1, last_synced_at: now, last_full_backfill_at: now }).run();

	const aCount = db.select({ c: sql<number>`count(*)` }).from(activities).all()[0].c;
	const gCount = db.select({ c: sql<number>`count(*)` }).from(gear).all()[0].c;
	const athCount = db.select({ c: sql<number>`count(*)` }).from(athletes).all()[0].c;

	return { athletes: athCount, gear: gCount, activities: aCount, withDetail };
}
