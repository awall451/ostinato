import { describe, it, expect } from 'vitest';
import { bucketGrid } from './bucket-grid';

const epoch = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 1000);

describe('bucketGrid', () => {
	describe('month bucket', () => {
		it('emits one key per month across a 6mo range, including months without activity', () => {
			const start = epoch(2026, 1, 1);
			const end = epoch(2026, 6, 30);
			expect(bucketGrid(start, end, 'month')).toEqual([
				'2026-01',
				'2026-02',
				'2026-03',
				'2026-04',
				'2026-05',
				'2026-06'
			]);
		});

		it('emits one key for a degenerate single-day range', () => {
			const t = epoch(2026, 4, 15);
			expect(bucketGrid(t, t, 'month')).toEqual(['2026-04']);
		});

		it('crosses a year boundary correctly', () => {
			const start = epoch(2025, 11, 15);
			const end = epoch(2026, 2, 10);
			expect(bucketGrid(start, end, 'month')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
		});
	});

	describe('week bucket', () => {
		it('emits monotonically-increasing ISO week keys for a 21-day range', () => {
			const start = epoch(2026, 1, 5);
			const end = epoch(2026, 1, 25);
			const keys = bucketGrid(start, end, 'week');
			expect(keys.length).toBeGreaterThanOrEqual(3);
			expect(keys.length).toBeLessThanOrEqual(4);
			for (let i = 1; i < keys.length; i++) {
				expect(keys[i] > keys[i - 1]).toBe(true);
			}
			for (const k of keys) expect(k).toMatch(/^\d{4}-W\d{2}$/);
		});

		it('emits a single key when start and end fall in the same week', () => {
			const start = epoch(2026, 4, 27);
			const end = epoch(2026, 4, 29);
			expect(bucketGrid(start, end, 'week')).toHaveLength(1);
		});
	});

	describe('year bucket', () => {
		it('emits one key per year across a 3-year range', () => {
			const start = epoch(2024, 1, 1);
			const end = epoch(2026, 12, 31);
			expect(bucketGrid(start, end, 'year')).toEqual(['2024', '2025', '2026']);
		});

		it('emits one key when start and end fall in the same year', () => {
			expect(bucketGrid(epoch(2026, 1, 1), epoch(2026, 12, 31), 'year')).toEqual(['2026']);
		});
	});

	describe('properties', () => {
		it('always emits at least one key when start <= end', () => {
			const t = epoch(2026, 4, 30);
			expect(bucketGrid(t, t, 'week').length).toBeGreaterThanOrEqual(1);
			expect(bucketGrid(t, t, 'month').length).toBeGreaterThanOrEqual(1);
			expect(bucketGrid(t, t, 'year').length).toBeGreaterThanOrEqual(1);
		});

		it('emits keys in strictly ascending order', () => {
			const start = epoch(2024, 6, 1);
			const end = epoch(2026, 6, 30);
			for (const b of ['week', 'month', 'year'] as const) {
				const keys = bucketGrid(start, end, b);
				for (let i = 1; i < keys.length; i++) {
					expect(keys[i] > keys[i - 1]).toBe(true);
				}
			}
		});
	});
});
