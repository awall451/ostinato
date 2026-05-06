import { describe, it, expect } from 'vitest';
import { sortBikes, type SortableBike } from './gear-sort';

const b = (name: string, count: number | null, distance_m: number | null): SortableBike =>
	count == null || distance_m == null
		? { name, totals: null }
		: { name, totals: { count, distance_m } };

describe('sortBikes', () => {
	it('sorts by distance descending', () => {
		const list = [b('A', 10, 100), b('B', 50, 500), b('C', 5, 5000)];
		expect(sortBikes(list, 'distance').map((x) => x.name)).toEqual(['C', 'B', 'A']);
	});

	it('sorts by count descending', () => {
		const list = [b('A', 10, 100), b('B', 50, 500), b('C', 5, 5000)];
		expect(sortBikes(list, 'count').map((x) => x.name)).toEqual(['B', 'A', 'C']);
	});

	it('treats null totals as zero', () => {
		const list = [b('A', 10, 100), b('Ghost', null, null), b('C', 5, 5000)];
		expect(sortBikes(list, 'distance').map((x) => x.name)).toEqual(['C', 'A', 'Ghost']);
		expect(sortBikes(list, 'count').map((x) => x.name)).toEqual(['A', 'C', 'Ghost']);
	});

	it('breaks ties by name ascending for determinism', () => {
		const list = [b('Zeta', 5, 100), b('Alpha', 5, 100), b('Mu', 5, 100)];
		expect(sortBikes(list, 'distance').map((x) => x.name)).toEqual(['Alpha', 'Mu', 'Zeta']);
		expect(sortBikes(list, 'count').map((x) => x.name)).toEqual(['Alpha', 'Mu', 'Zeta']);
	});

	it('does not mutate the input array', () => {
		const list = [b('A', 10, 100), b('B', 50, 500)];
		const snapshot = list.map((x) => x.name);
		sortBikes(list, 'distance');
		expect(list.map((x) => x.name)).toEqual(snapshot);
	});

	it('returns an empty array for empty input', () => {
		expect(sortBikes([], 'distance')).toEqual([]);
	});
});
