/**
 * Google encoded polyline → [lat, lng] pairs.
 *
 * Strava uses Google's algorithm at precision=5 for `summary_polyline`
 * (and stream `latlng`). Future heatmap work reuses this helper.
 */
export function decodePolyline(_encoded: string): [number, number][] {
	return [];
}
