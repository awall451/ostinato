import { describe, it, expect } from 'vitest';
import { effectiveSportType, friendlyLabel } from './sport-types';

describe('effectiveSportType', () => {
	const mtbGear = new Map([['b1', { frame_type: 1 }]]);
	const crossGear = new Map([['b1', { frame_type: 2 }]]);
	const roadGear = new Map([['b1', { frame_type: 3 }]]);
	const ttGear = new Map([['b1', { frame_type: 4 }]]);
	const gravelGear = new Map([['b1', { frame_type: 5 }]]);
	const noFrame = new Map([['b1', { frame_type: null }]]);
	const empty = new Map();

	it('routes Ride + MTB-frame bike to MountainBikeRide', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b1' }, mtbGear)).toBe(
			'MountainBikeRide'
		);
	});

	it('routes Ride + frame_type 5 (gravel) to GravelRide', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b1' }, gravelGear)).toBe(
			'GravelRide'
		);
	});

	it('routes Ride + frame_type 2 (cross) to GravelRide', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b1' }, crossGear)).toBe('GravelRide');
	});

	it('keeps Ride + road-frame as generic Ride (true road no longer relabeled)', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b1' }, roadGear)).toBe('Ride');
	});

	it('keeps Ride + TT frame as generic Ride', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b1' }, ttGear)).toBe('Ride');
	});

	it('keeps Ride with null gear_id as generic Ride', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: null }, mtbGear)).toBe('Ride');
	});

	it('keeps Ride with unknown gear_id as generic Ride', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b999' }, mtbGear)).toBe('Ride');
	});

	it('keeps Ride when gear has null frame_type', () => {
		expect(effectiveSportType({ sport_type: 'Ride', gear_id: 'b1' }, noFrame)).toBe('Ride');
	});

	it('passes MountainBikeRide through unchanged regardless of gear', () => {
		expect(effectiveSportType({ sport_type: 'MountainBikeRide', gear_id: 'b1' }, roadGear)).toBe(
			'MountainBikeRide'
		);
	});

	it('passes GravelRide through unchanged', () => {
		expect(effectiveSportType({ sport_type: 'GravelRide', gear_id: 'b1' }, mtbGear)).toBe(
			'GravelRide'
		);
	});

	it('passes Run through unchanged', () => {
		expect(effectiveSportType({ sport_type: 'Run', gear_id: null }, empty)).toBe('Run');
	});
});

describe('friendlyLabel', () => {
	it('renders generic Ride as "Ride", not "Road"', () => {
		expect(friendlyLabel('Ride')).toBe('Ride');
	});

	it('still maps MountainBikeRide to MTB', () => {
		expect(friendlyLabel('MountainBikeRide')).toBe('MTB');
	});

	it('still maps GravelRide to Gravel', () => {
		expect(friendlyLabel('GravelRide')).toBe('Gravel');
	});
});
