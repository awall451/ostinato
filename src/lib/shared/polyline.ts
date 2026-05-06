import polyline from '@mapbox/polyline';

/**
 * Google encoded polyline → [lat, lng] pairs.
 *
 * Strava uses Google's algorithm at precision=5 for `summary_polyline`
 * (and stream `latlng`). Future heatmap work reuses this helper.
 */
export function decodePolyline(encoded: string): [number, number][] {
	if (!encoded) return [];
	return polyline.decode(encoded) as [number, number][];
}

/** Tight bounding box [[south, west], [north, east]] for a polyline path. */
export function bounds(coords: [number, number][]): [[number, number], [number, number]] | null {
	if (coords.length === 0) return null;
	let s = coords[0][0],
		n = coords[0][0],
		w = coords[0][1],
		e = coords[0][1];
	for (const [lat, lng] of coords) {
		if (lat < s) s = lat;
		if (lat > n) n = lat;
		if (lng < w) w = lng;
		if (lng > e) e = lng;
	}
	return [
		[s, w],
		[n, e]
	];
}
