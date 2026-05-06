/**
 * Pure parsers for the Strava DetailedActivity payload (`activities.raw_detail_json`).
 * Helpers are intentionally tolerant of unknown shape — Strava sometimes omits fields,
 * and the parsers fall back to safe defaults.
 */

export type SplitRow = {
	index: number;
	distance_m: number;
	moving_time_s: number;
	elapsed_time_s: number;
	elevation_difference_m: number;
	average_heartrate: number | null;
	pace_seconds_per_unit: number; // s per unit (mi for imperial, km for metric)
};

export type SegmentEffortRow = {
	segment_id: number;
	segment_name: string;
	distance_m: number;
	moving_time_s: number;
	elapsed_time_s: number;
	average_heartrate: number | null;
	average_watts: number | null;
	kom_rank: number | null;
	pr_rank: number | null;
};

export function parseDescription(_detail: unknown): string | null {
	return null;
}

export function parseSplits(_detail: unknown, _system: 'imperial' | 'metric'): SplitRow[] {
	return [];
}

export function parseSegmentEfforts(_detail: unknown): SegmentEffortRow[] {
	return [];
}
