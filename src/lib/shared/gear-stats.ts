import { metersToMiles, metersToKm, type UnitSystem, M_PER_MI } from './units';
import { effectiveSportType, friendlyLabel } from './sport-types';
import { monthKey } from './time';

export type ActivityForStats = {
	start_date: number;
	start_date_local: number;
	distance_m: number;
	sport_type: string;
	gear_id: string | null;
};

export type GearForSport = { frame_type: number | null };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// Default histogram edges in meters: 0, 10mi, 25mi, 50mi.
export const DEFAULT_HISTOGRAM_EDGES_M = [0, 10 * M_PER_MI, 25 * M_PER_MI, 50 * M_PER_MI] as const;

export function cumulativeDistance(
	activities: ActivityForStats[],
	units: UnitSystem
): { label: string; value: number }[] {
	if (activities.length === 0) return [];
	const convert = units === 'imperial' ? metersToMiles : metersToKm;
	const monthly = new Map<string, number>();
	for (const a of activities) {
		const k = monthKey(a.start_date);
		monthly.set(k, (monthly.get(k) ?? 0) + a.distance_m);
	}
	const ordered = [...monthly.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
	let running = 0;
	return ordered.map(([label, m]) => {
		running += m;
		return { label, value: convert(running) };
	});
}

export function dayOfWeekBuckets(
	activities: ActivityForStats[]
): { day: string; rides: number; distance_m: number }[] {
	const out = WEEKDAYS.map((day) => ({ day, rides: 0, distance_m: 0 }));
	for (const a of activities) {
		const dow = new Date(a.start_date_local * 1000).getUTCDay();
		out[dow].rides += 1;
		out[dow].distance_m += a.distance_m;
	}
	return out;
}

export function rideLengthHistogram(
	activities: ActivityForStats[],
	edges: readonly number[] = DEFAULT_HISTOGRAM_EDGES_M,
	units: UnitSystem = 'imperial'
): { label: string; count: number; distance_m: number }[] {
	const unitLabel = units === 'imperial' ? 'mi' : 'km';
	const convert = units === 'imperial' ? metersToMiles : metersToKm;
	const labels: string[] = [];
	for (let i = 0; i < edges.length; i++) {
		const lo = Math.round(convert(edges[i]));
		if (i === edges.length - 1) {
			labels.push(`${lo}+ ${unitLabel}`);
		} else {
			const hi = Math.round(convert(edges[i + 1]));
			labels.push(`${lo}–${hi} ${unitLabel}`);
		}
	}
	const buckets = labels.map((label) => ({ label, count: 0, distance_m: 0 }));
	for (const a of activities) {
		let bi = 0;
		for (let i = 0; i < edges.length - 1; i++) {
			if (a.distance_m >= edges[i + 1]) bi = i + 1;
		}
		buckets[bi].count += 1;
		buckets[bi].distance_m += a.distance_m;
	}
	return buckets;
}

export function sportMixSlices(
	activities: ActivityForStats[],
	gearById: Map<string, GearForSport>
): { name: string; value: number }[] {
	if (activities.length === 0) return [];
	const counts = new Map<string, number>();
	for (const a of activities) {
		const eff = effectiveSportType(a, gearById);
		const friendly = friendlyLabel(eff);
		counts.set(friendly, (counts.get(friendly) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([name, value]) => ({ name, value }))
		.sort((x, y) => y.value - x.value);
}
