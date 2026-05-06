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

type Detail = Record<string, unknown> | null | undefined;

const METERS_PER_MILE = 1609.34;
const METERS_PER_KM = 1000;

function asObj(x: unknown): Record<string, unknown> | null {
	return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function asArr(x: unknown): unknown[] {
	return Array.isArray(x) ? x : [];
}

function asNum(x: unknown): number | null {
	return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

function asStr(x: unknown): string | null {
	return typeof x === 'string' ? x : null;
}

export function parseDescription(detail: Detail): string | null {
	const obj = asObj(detail);
	if (!obj) return null;
	const d = asStr(obj.description);
	if (d == null) return null;
	const trimmed = d.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function parseSplits(detail: Detail, system: 'imperial' | 'metric'): SplitRow[] {
	const obj = asObj(detail);
	if (!obj) return [];
	const standard = asArr(obj.splits_standard);
	const metric = asArr(obj.splits_metric);
	const useStandard = system === 'imperial' && standard.length > 0;
	const source = useStandard ? standard : metric.length > 0 ? metric : [];
	const unit = useStandard ? METERS_PER_MILE : METERS_PER_KM;

	const rows: SplitRow[] = [];
	for (const raw of source) {
		const s = asObj(raw);
		if (!s) continue;
		const distance_m = asNum(s.distance) ?? 0;
		const moving_time_s = asNum(s.moving_time) ?? 0;
		const elapsed_time_s = asNum(s.elapsed_time) ?? moving_time_s;
		const elev = asNum(s.elevation_difference) ?? 0;
		const hr = asNum(s.average_heartrate);
		const idx = asNum(s.split) ?? rows.length + 1;
		// Pace = seconds per unit (mi or km), normalized so a half-distance partial
		// split still produces a comparable per-unit pace number.
		const units = distance_m > 0 ? distance_m / unit : 1;
		const pace = moving_time_s / units;
		rows.push({
			index: idx,
			distance_m,
			moving_time_s,
			elapsed_time_s,
			elevation_difference_m: elev,
			average_heartrate: hr,
			pace_seconds_per_unit: pace
		});
	}
	return rows;
}

export function parseSegmentEfforts(detail: Detail): SegmentEffortRow[] {
	const obj = asObj(detail);
	if (!obj) return [];
	const efforts = asArr(obj.segment_efforts);
	const rows: SegmentEffortRow[] = [];
	for (const raw of efforts) {
		const e = asObj(raw);
		if (!e) continue;
		const seg = asObj(e.segment);
		const segId = asNum(seg?.id);
		if (segId == null) continue;
		rows.push({
			segment_id: segId,
			segment_name: asStr(seg?.name) ?? `segment ${segId}`,
			distance_m: asNum(e.distance) ?? 0,
			moving_time_s: asNum(e.moving_time) ?? 0,
			elapsed_time_s: asNum(e.elapsed_time) ?? 0,
			average_heartrate: asNum(e.average_heartrate),
			average_watts: asNum(e.average_watts),
			kom_rank: asNum(e.kom_rank),
			pr_rank: asNum(e.pr_rank)
		});
	}
	return rows;
}
