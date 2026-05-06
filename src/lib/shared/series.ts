/**
 * Reduce dense time-series streams (~3600 samples for a 1h ride) down to a
 * bounded number of points before SVG-rendering. Picks evenly spaced indices,
 * always preserving the first and last sample so the chart edges stay accurate.
 */

export type Point = { x: number; y: number };

export function downsampleSeries(
	xs: number[],
	ys: number[],
	maxPoints = 600
): Point[] {
	if (xs.length === 0 || ys.length === 0) return [];
	const n = Math.min(xs.length, ys.length);
	if (n <= maxPoints) {
		const out: Point[] = [];
		for (let i = 0; i < n; i++) out.push({ x: xs[i], y: ys[i] });
		return out;
	}
	const out: Point[] = [{ x: xs[0], y: ys[0] }];
	const step = (n - 1) / (maxPoints - 1);
	for (let k = 1; k < maxPoints - 1; k++) {
		const i = Math.round(k * step);
		out.push({ x: xs[i], y: ys[i] });
	}
	out.push({ x: xs[n - 1], y: ys[n - 1] });
	return out;
}
