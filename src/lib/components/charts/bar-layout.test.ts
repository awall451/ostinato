import { describe, it, expect } from 'vitest';
import { computeBarLayout } from './bar-layout';

describe('computeBarLayout', () => {
	it('gives fat bars when bucket count is small', () => {
		const { barStep, barWidth } = computeBarLayout(3, 744);
		expect(barStep).toBeCloseTo(248, 0);
		expect(barWidth).toBeCloseTo(186, 0);
	});

	it('gives thin bars when bucket count is large', () => {
		const { barStep, barWidth } = computeBarLayout(12, 744);
		expect(barStep).toBeCloseTo(62, 1);
		expect(barWidth).toBeCloseTo(46.5, 1);
	});

	it('does not divide by zero on empty input', () => {
		const { barStep, barWidth } = computeBarLayout(0, 744);
		expect(barStep).toBeGreaterThan(0);
		expect(barWidth).toBeGreaterThan(0);
		expect(Number.isFinite(barStep)).toBe(true);
		expect(Number.isFinite(barWidth)).toBe(true);
	});

	it('returns barWidth strictly less than barStep so adjacent bars never touch', () => {
		for (let n = 1; n <= 30; n++) {
			const { barStep, barWidth } = computeBarLayout(n, 744);
			expect(barWidth).toBeLessThan(barStep);
		}
	});

	it('never overflows the inner viewBox width across bucket counts 1..52', () => {
		for (let n = 1; n <= 52; n++) {
			const { barStep } = computeBarLayout(n, 744);
			expect(barStep * n).toBeLessThanOrEqual(744 + 1e-6);
		}
	});

	it('scales with innerWidth', () => {
		const small = computeBarLayout(6, 400);
		const large = computeBarLayout(6, 800);
		expect(large.barStep).toBeCloseTo(small.barStep * 2, 6);
		expect(large.barWidth).toBeCloseTo(small.barWidth * 2, 6);
	});
});
