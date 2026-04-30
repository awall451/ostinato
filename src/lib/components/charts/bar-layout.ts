/**
 * Returns bar geometry for a stacked bar chart given a bucket count and inner
 * (paddings-already-subtracted) viewBox width.
 *
 * Invariant: `barStep * bucketCount <= innerWidth` for all n >= 1, so bars
 * never overflow the inner area regardless of bucket count. Bar width is
 * 75% of step so adjacent bars never touch.
 */
export function computeBarLayout(
	bucketCount: number,
	innerWidth: number
): { barStep: number; barWidth: number } {
	const n = Math.max(bucketCount, 1);
	const barStep = innerWidth / n;
	const barWidth = barStep * 0.75;
	return { barStep, barWidth };
}
