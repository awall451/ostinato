import { describe, it, expect } from 'vitest';
import { colorByGearId } from './gear-color';
import { PALETTE } from './palette';

describe('colorByGearId', () => {
	it('assigns palette colors by sorted-id position', () => {
		const map = colorByGearId(['b1', 'b2', 'b3']);
		expect(map.b1).toBe(PALETTE[0]);
		expect(map.b2).toBe(PALETTE[1]);
		expect(map.b3).toBe(PALETTE[2]);
	});

	it('is deterministic — same input always returns same map', () => {
		const a = colorByGearId(['b9', 'b1', 'b5']);
		const b = colorByGearId(['b9', 'b1', 'b5']);
		expect(a).toEqual(b);
	});

	it('wraps the palette when bike count exceeds palette length', () => {
		const ids = Array.from({ length: PALETTE.length + 3 }, (_, i) => `b${i}`);
		const map = colorByGearId(ids);
		expect(map[`b${PALETTE.length}`]).toBe(PALETTE[0]);
		expect(map[`b${PALETTE.length + 1}`]).toBe(PALETTE[1]);
		expect(map[`b${PALETTE.length + 2}`]).toBe(PALETTE[2]);
	});

	it('returns undefined for an unknown id', () => {
		const map = colorByGearId(['b1', 'b2']);
		expect(map['b999']).toBeUndefined();
	});

	it('returns an empty map for an empty input', () => {
		expect(colorByGearId([])).toEqual({});
	});
});
