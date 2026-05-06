export type SortableTotals = { count: number; distance_m: number } | null;
export type SortableBike = { name: string; totals: SortableTotals };

export type SortMetric = 'count' | 'distance';

export function sortBikes<T extends SortableBike>(bikes: T[], by: SortMetric): T[] {
	void by;
	return [...bikes];
}
