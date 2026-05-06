import { describe, it, expect } from 'vitest';
import { decodePolyline } from './polyline';

describe('decodePolyline', () => {
	it('returns [] for the empty string', () => {
		expect(decodePolyline('')).toEqual([]);
	});

	it("decodes Google's canonical example to three coord pairs", () => {
		// From https://developers.google.com/maps/documentation/utilities/polylinealgorithm
		const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
		const got = decodePolyline(encoded);
		expect(got).toHaveLength(3);
		// Round to 5 decimals (precision=5) for stable comparison.
		const rounded = got.map(([lat, lng]) => [round5(lat), round5(lng)]);
		expect(rounded).toEqual([
			[38.5, -120.2],
			[40.7, -120.95],
			[43.252, -126.453]
		]);
	});

	it('decodes a simple two-point polyline', () => {
		// Encoded form of [[0, 0], [1, 1]] at precision=5.
		const encoded = '??_ibE_ibE';
		const got = decodePolyline(encoded);
		expect(got).toHaveLength(2);
		expect(round5(got[0][0])).toBe(0);
		expect(round5(got[0][1])).toBe(0);
		expect(round5(got[1][0])).toBe(1);
		expect(round5(got[1][1])).toBe(1);
	});
});

function round5(n: number): number {
	return Math.round(n * 1e5) / 1e5;
}
