import { metersToMiles, metersToKm, type UnitSystem } from './units';
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

export function cumulativeDistance(
	activities: ActivityForStats[],
	units: UnitSystem
): { label: string; value: number }[] {
	void activities;
	void units;
	void metersToMiles;
	void metersToKm;
	void monthKey;
	return [];
}

export function dayOfWeekBuckets(
	activities: ActivityForStats[]
): { day: string; rides: number; distance_m: number }[] {
	void activities;
	void WEEKDAYS;
	return [];
}

export const DEFAULT_HISTOGRAM_EDGES_M = [0, 16093.44, 40233.6, 80467.2] as const;

export function rideLengthHistogram(
	activities: ActivityForStats[],
	edges: readonly number[] = DEFAULT_HISTOGRAM_EDGES_M,
	units: UnitSystem = 'imperial'
): { label: string; count: number; distance_m: number }[] {
	void activities;
	void edges;
	void units;
	return [];
}

export function sportMixSlices(
	activities: ActivityForStats[],
	gearById: Map<string, GearForSport>
): { name: string; value: number }[] {
	void activities;
	void gearById;
	void effectiveSportType;
	void friendlyLabel;
	return [];
}
