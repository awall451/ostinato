import { describe, it, expect } from 'vitest';
import {
	cumulativeDistance,
	dayOfWeekBuckets,
	rideLengthHistogram,
	sportMixSlices,
	type ActivityForStats,
	type GearForSport
} from './gear-stats';

const epoch = (y: number, m: number, d: number, h = 12) =>
	Math.floor(Date.UTC(y, m - 1, d, h) / 1000);

const a = (
	yyyy: number,
	mm: number,
	dd: number,
	distance_m: number,
	sport_type = 'Ride',
	gear_id: string | null = null
): ActivityForStats => {
	const t = epoch(yyyy, mm, dd);
	return {
		start_date: t,
		start_date_local: t,
		distance_m,
		sport_type,
		gear_id
	};
};

describe('cumulativeDistance', () => {
	it('returns empty for empty input', () => {
		expect(cumulativeDistance([], 'imperial')).toEqual([]);
	});

	it('produces a monotonically non-decreasing series in miles', () => {
		const acts = [a(2026, 1, 5, 16093.44), a(2026, 2, 1, 16093.44), a(2026, 3, 1, 32186.88)];
		const out = cumulativeDistance(acts, 'imperial');
		expect(out.map((p) => p.label)).toEqual(['2026-01', '2026-02', '2026-03']);
		expect(out.map((p) => Math.round(p.value))).toEqual([10, 20, 40]);
	});

	it('respects metric system', () => {
		const acts = [a(2026, 1, 1, 10000)];
		const out = cumulativeDistance(acts, 'metric');
		expect(Math.round(out[0].value)).toBe(10);
	});

	it('aggregates within a single month', () => {
		const acts = [a(2026, 4, 1, 1000), a(2026, 4, 5, 4000), a(2026, 4, 10, 5000)];
		const out = cumulativeDistance(acts, 'metric');
		expect(out).toHaveLength(1);
		expect(out[0].value).toBe(10);
	});
});

describe('dayOfWeekBuckets', () => {
	it('returns 7 buckets always, even with no input', () => {
		const out = dayOfWeekBuckets([]);
		expect(out).toHaveLength(7);
		expect(out.map((b) => b.day)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
		expect(out.every((b) => b.rides === 0 && b.distance_m === 0)).toBe(true);
	});

	it('counts rides per weekday using start_date_local', () => {
		// 2026-05-03 is a Sunday (UTC); 2026-05-04 is Monday.
		const out = dayOfWeekBuckets([a(2026, 5, 3, 1000), a(2026, 5, 4, 2000), a(2026, 5, 4, 3000)]);
		expect(out[0]).toEqual({ day: 'Sun', rides: 1, distance_m: 1000 });
		expect(out[1]).toEqual({ day: 'Mon', rides: 2, distance_m: 5000 });
		expect(out[2].rides).toBe(0);
	});
});

describe('rideLengthHistogram', () => {
	it('returns 4 default imperial buckets even with no input', () => {
		const out = rideLengthHistogram([]);
		expect(out.map((b) => b.label)).toEqual(['0–10 mi', '10–25 mi', '25–50 mi', '50+ mi']);
		expect(out.every((b) => b.count === 0 && b.distance_m === 0)).toBe(true);
	});

	it('routes activities into the correct bucket by distance', () => {
		// 5 mi, 15 mi, 30 mi, 60 mi, 100 mi → buckets 0,1,2,3,3
		const acts = [
			a(2026, 1, 1, 5 * 1609.344),
			a(2026, 1, 2, 15 * 1609.344),
			a(2026, 1, 3, 30 * 1609.344),
			a(2026, 1, 4, 60 * 1609.344),
			a(2026, 1, 5, 100 * 1609.344)
		];
		const out = rideLengthHistogram(acts);
		expect(out.map((b) => b.count)).toEqual([1, 1, 1, 2]);
	});

	it('sums distances per bucket', () => {
		const acts = [a(2026, 1, 1, 5 * 1609.344), a(2026, 1, 2, 7 * 1609.344)];
		const out = rideLengthHistogram(acts);
		expect(out[0].count).toBe(2);
		expect(Math.round(out[0].distance_m / 1609.344)).toBe(12);
	});

	it('honors custom edges in metric units', () => {
		const acts = [a(2026, 1, 1, 5000), a(2026, 1, 2, 25000), a(2026, 1, 3, 75000)];
		const out = rideLengthHistogram(acts, [0, 10000, 50000], 'metric');
		expect(out.map((b) => b.label)).toEqual(['0–10 km', '10–50 km', '50+ km']);
		expect(out.map((b) => b.count)).toEqual([1, 1, 1]);
	});
});

describe('sportMixSlices', () => {
	const mtbGear: GearForSport = { frame_type: 1 };
	const gravelGear: GearForSport = { frame_type: 5 };
	const gearById = new Map<string, GearForSport>([
		['b-mtb', mtbGear],
		['b-gravel', gravelGear]
	]);

	it('returns empty for empty input', () => {
		expect(sportMixSlices([], gearById)).toEqual([]);
	});

	it('groups by friendly sport name', () => {
		const acts = [
			a(2026, 1, 1, 10000, 'Ride', 'b-mtb'),
			a(2026, 1, 2, 10000, 'Ride', 'b-mtb'),
			a(2026, 1, 3, 10000, 'Ride', 'b-gravel')
		];
		const out = sportMixSlices(acts, gearById);
		const map = Object.fromEntries(out.map((s) => [s.name, s.value]));
		expect(map['MTB']).toBe(2);
		expect(map['Gravel']).toBe(1);
	});

	it('routes generic Ride to MTB or Gravel based on frame_type', () => {
		// One Ride on MTB → MTB; one Ride with no gear → Ride; one MountainBikeRide → MTB
		const acts = [
			a(2026, 1, 1, 10000, 'Ride', 'b-mtb'),
			a(2026, 1, 2, 10000, 'Ride', null),
			a(2026, 1, 3, 10000, 'MountainBikeRide', 'b-mtb')
		];
		const out = sportMixSlices(acts, gearById);
		const map = Object.fromEntries(out.map((s) => [s.name, s.value]));
		expect(map['MTB']).toBe(2);
		expect(map['Ride']).toBe(1);
	});
});
