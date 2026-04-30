/**
 * Returns bar geometry for a stacked bar chart given a bucket count and inner
 * (paddings-already-subtracted) viewBox width. Bars never overflow innerWidth.
 * Stub: returns zero dimensions. Implemented in the green commit.
 */
export function computeBarLayout(
	_bucketCount: number,
	_innerWidth: number
): { barStep: number; barWidth: number } {
	return { barStep: 0, barWidth: 0 };
}
