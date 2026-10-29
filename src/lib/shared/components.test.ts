import { describe, it, expect } from 'vitest';
import {
	COMPONENT_KINDS,
	componentKind,
	wearStatus,
	dateInputToEpoch,
	epochToDateInput
} from './components';

describe('wearStatus', () => {
	it('is none without a limit', () => {
		expect(wearStatus(5000, null)).toEqual({ level: 'none', pct: null });
		expect(wearStatus(5000, 0)).toEqual({ level: 'none', pct: null });
	});

	it('classifies ok / warn / due at 80% and 100%', () => {
		expect(wearStatus(0, 1000)).toEqual({ level: 'ok', pct: 0 });
		expect(wearStatus(799, 1000).level).toBe('ok');
		expect(wearStatus(800, 1000).level).toBe('warn');
		expect(wearStatus(999, 1000).level).toBe('warn');
		expect(wearStatus(1000, 1000).level).toBe('due');
		expect(wearStatus(1500, 1000)).toEqual({ level: 'due', pct: 1.5 });
	});
});

describe('date helpers', () => {
	it('round-trips YYYY-MM-DD through UTC-midnight epoch', () => {
		const e = dateInputToEpoch('2025-06-01');
		expect(e).toBe(Date.UTC(2025, 5, 1) / 1000);
		expect(epochToDateInput(e!)).toBe('2025-06-01');
	});

	it('rejects junk', () => {
		expect(dateInputToEpoch('')).toBeNull();
		expect(dateInputToEpoch('not-a-date')).toBeNull();
		expect(dateInputToEpoch('2025-13-40')).toBeNull();
	});
});

describe('COMPONENT_KINDS', () => {
	it('has unique values and covers the consumables', () => {
		const values = COMPONENT_KINDS.map((k) => k.value);
		expect(new Set(values).size).toBe(values.length);
		for (const v of ['chain', 'cassette', 'tire_front', 'tire_rear', 'brake_pads', 'other']) {
			expect(values).toContain(v);
		}
	});

	it('tires skip trainer miles by default; chain counts them', () => {
		expect(componentKind('tire_rear').defaultCountTrainer).toBe(false);
		expect(componentKind('chain').defaultCountTrainer).toBe(true);
		expect(componentKind('chain').defaultWearMi).toBeGreaterThan(0);
	});

	it('falls back to a labeled custom kind for unknown values', () => {
		expect(componentKind('mystery').label).toBe('mystery');
	});
});
