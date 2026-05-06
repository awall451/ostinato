export type SortableTotals = { count: number; distance_m: number } | null;
export type SortableBike = { name: string; totals: SortableTotals };

export type SortMetric = 'count' | 'distance';

function metricVal(b: SortableBike, by: SortMetric): number {
	if (!b.totals) return 0;
	return by === 'count' ? b.totals.count : b.totals.distance_m;
}

export function sortBikes<T extends SortableBike>(bikes: T[], by: SortMetric): T[] {
	return [...bikes].sort((a, b) => {
		const av = metricVal(a, by);
		const bv = metricVal(b, by);
		if (av !== bv) return bv - av;
		return a.name.localeCompare(b.name);
	});
}
