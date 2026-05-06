/**
 * Reduce dense time-series streams (~3600 samples for a 1h ride) down to a
 * bounded number of points before SVG-rendering. Picks evenly spaced indices,
 * always preserving the first and last sample so the chart edges stay accurate.
 */

export type Point = { x: number; y: number };

export function downsampleSeries(
	_xs: number[],
	_ys: number[],
	_maxPoints = 600
): Point[] {
	// stub — implemented in green commit
	return [];
}
