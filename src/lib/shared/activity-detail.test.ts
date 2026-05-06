import { describe, it, expect } from 'vitest';
import { parseDescription, parseSplits, parseSegmentEfforts } from './activity-detail';

describe('parseDescription', () => {
	it('returns null when missing', () => {
		expect(parseDescription({})).toBeNull();
		expect(parseDescription(null)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseDescription({ description: '' })).toBeNull();
		expect(parseDescription({ description: '   ' })).toBeNull();
	});

	it('returns the description when present', () => {
		expect(parseDescription({ description: 'felt great' })).toBe('felt great');
	});
});

describe('parseSplits', () => {
	const sampleDetail = {
		splits_metric: [
			{ split: 1, distance: 1000, moving_time: 240, elapsed_time: 245, elevation_difference: 10, average_heartrate: 145 },
			{ split: 2, distance: 1000, moving_time: 250, elapsed_time: 255, elevation_difference: 5, average_heartrate: 150 }
		],
		splits_standard: [
			{ split: 1, distance: 1609.34, moving_time: 386, elapsed_time: 390, elevation_difference: 16, average_heartrate: 145 },
			{ split: 2, distance: 1609.34, moving_time: 400, elapsed_time: 405, elevation_difference: 8, average_heartrate: 150 }
		]
	};

	it('returns [] when neither splits_metric nor splits_standard present', () => {
		expect(parseSplits({}, 'imperial')).toEqual([]);
	});

	it('imperial picks splits_standard', () => {
		const rows = parseSplits(sampleDetail, 'imperial');
		expect(rows).toHaveLength(2);
		expect(rows[0].index).toBe(1);
		expect(rows[0].moving_time_s).toBe(386);
		// 386 s / (1609.34 m / 1609.34) = 386 s/mi
		expect(Math.round(rows[0].pace_seconds_per_unit)).toBe(386);
	});

	it('metric picks splits_metric', () => {
		const rows = parseSplits(sampleDetail, 'metric');
		expect(rows).toHaveLength(2);
		expect(rows[0].moving_time_s).toBe(240);
		// 240 s / 1km = 240 s/km
		expect(Math.round(rows[0].pace_seconds_per_unit)).toBe(240);
	});

	it('handles a partial last split (half-distance)', () => {
		const partial = {
			splits_metric: [{ split: 1, distance: 500, moving_time: 120, elapsed_time: 125, elevation_difference: 0, average_heartrate: 140 }]
		};
		const rows = parseSplits(partial, 'metric');
		// 120 s for 0.5 km → 240 s/km extrapolated pace
		expect(Math.round(rows[0].pace_seconds_per_unit)).toBe(240);
	});

	it('falls back to splits_metric when splits_standard absent in imperial', () => {
		const detail = { splits_metric: sampleDetail.splits_metric };
		const rows = parseSplits(detail, 'imperial');
		expect(rows).toHaveLength(2); // metric used as fallback
	});
});

describe('parseSegmentEfforts', () => {
	const sampleDetail = {
		segment_efforts: [
			{
				segment: { id: 12345, name: 'Big Climb' },
				distance: 850,
				moving_time: 240,
				elapsed_time: 245,
				average_heartrate: 175,
				average_watts: 280,
				kom_rank: 3,
				pr_rank: 1
			},
			{
				segment: { id: 67890, name: 'Sprint Section' },
				distance: 200,
				moving_time: 18,
				elapsed_time: 18,
				average_heartrate: 180,
				average_watts: 600,
				kom_rank: null,
				pr_rank: null
			}
		]
	};

	it('returns [] when segment_efforts missing or empty', () => {
		expect(parseSegmentEfforts({})).toEqual([]);
		expect(parseSegmentEfforts({ segment_efforts: [] })).toEqual([]);
	});

	it('extracts the columns the page renders', () => {
		const rows = parseSegmentEfforts(sampleDetail);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			segment_id: 12345,
			segment_name: 'Big Climb',
			distance_m: 850,
			moving_time_s: 240,
			elapsed_time_s: 245,
			average_heartrate: 175,
			average_watts: 280,
			kom_rank: 3,
			pr_rank: 1
		});
		expect(rows[1].kom_rank).toBeNull();
		expect(rows[1].pr_rank).toBeNull();
	});

	it('skips entries lacking a segment.id', () => {
		const detail = {
			segment_efforts: [
				{ segment: { name: 'Bad' }, distance: 100, moving_time: 10, elapsed_time: 10 },
				{ segment: { id: 1, name: 'Good' }, distance: 100, moving_time: 10, elapsed_time: 10 }
			]
		};
		const rows = parseSegmentEfforts(detail);
		expect(rows).toHaveLength(1);
		expect(rows[0].segment_id).toBe(1);
	});
});
