import { describe, it, expect } from 'vitest';
import { downsampleSeries } from './series';

describe('downsampleSeries', () => {
	it('returns [] for empty inputs', () => {
		expect(downsampleSeries([], [])).toEqual([]);
		expect(downsampleSeries([1], [])).toEqual([]);
	});

	it('returns the full series unchanged when n <= maxPoints', () => {
		const xs = [0, 1, 2, 3, 4];
		const ys = [10, 11, 12, 13, 14];
		const got = downsampleSeries(xs, ys, 10);
		expect(got).toHaveLength(5);
		expect(got[0]).toEqual({ x: 0, y: 10 });
		expect(got[4]).toEqual({ x: 4, y: 14 });
	});

	it('caps at maxPoints when series is longer', () => {
		const n = 5000;
		const xs = Array.from({ length: n }, (_, i) => i);
		const ys = Array.from({ length: n }, (_, i) => i * 2);
		const got = downsampleSeries(xs, ys, 600);
		expect(got).toHaveLength(600);
	});

	it('always preserves first and last samples', () => {
		const n = 2000;
		const xs = Array.from({ length: n }, (_, i) => i);
		const ys = Array.from({ length: n }, (_, i) => 100 - i);
		const got = downsampleSeries(xs, ys, 100);
		expect(got[0]).toEqual({ x: 0, y: 100 });
		expect(got[got.length - 1]).toEqual({ x: n - 1, y: 100 - (n - 1) });
	});

	it('uses min(xs.length, ys.length) when arrays disagree', () => {
		const xs = [0, 1, 2, 3, 4];
		const ys = [10, 11, 12]; // shorter
		const got = downsampleSeries(xs, ys, 100);
		expect(got).toHaveLength(3);
		expect(got[2]).toEqual({ x: 2, y: 12 });
	});
});
