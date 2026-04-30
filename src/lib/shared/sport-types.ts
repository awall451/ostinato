/**
 * Strava sport_type values and groupings.
 * Reference: https://developers.strava.com/docs/reference/#api-models-SportType
 */

export type SportFamily = 'ride' | 'run' | 'walk' | 'hike' | 'swim' | 'workout' | 'other';

const RIDE_TYPES = new Set([
	'Ride',
	'MountainBikeRide',
	'EMountainBikeRide',
	'GravelRide',
	'EBikeRide',
	'VirtualRide',
	'Velomobile',
	'Handcycle',
	'EHandcycle'
]);

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const WALK_TYPES = new Set(['Walk']);
const HIKE_TYPES = new Set(['Hike']);
const SWIM_TYPES = new Set(['Swim']);
const WORKOUT_TYPES = new Set(['Workout', 'WeightTraining', 'Yoga', 'Crossfit', 'Pilates', 'Elliptical', 'StairStepper', 'Rowing']);

export function familyOf(sport: string): SportFamily {
	if (RIDE_TYPES.has(sport)) return 'ride';
	if (RUN_TYPES.has(sport)) return 'run';
	if (WALK_TYPES.has(sport)) return 'walk';
	if (HIKE_TYPES.has(sport)) return 'hike';
	if (SWIM_TYPES.has(sport)) return 'swim';
	if (WORKOUT_TYPES.has(sport)) return 'workout';
	return 'other';
}

const FRIENDLY: Record<string, string> = {
	Ride: 'Road',
	MountainBikeRide: 'MTB',
	EMountainBikeRide: 'eMTB',
	GravelRide: 'Gravel',
	EBikeRide: 'eBike',
	VirtualRide: 'Virtual Ride',
	Run: 'Run',
	TrailRun: 'Trail Run',
	VirtualRun: 'Virtual Run',
	Walk: 'Walk',
	Hike: 'Hike',
	Swim: 'Swim',
	Workout: 'Workout',
	WeightTraining: 'Lifting',
	Yoga: 'Yoga',
	Rowing: 'Row'
};

export function friendlyLabel(sport: string): string {
	return FRIENDLY[sport] ?? sport;
}

export const RIDE_FAMILY = Array.from(RIDE_TYPES);
export const RUN_FAMILY = Array.from(RUN_TYPES);
