/** Strava native units → display units. Storage stays meters/seconds/m·s⁻¹. */

export const M_PER_MI = 1609.344;
export const M_PER_FT = 0.3048;
export const MPS_PER_MPH = 0.44704;
export const MPS_PER_KMH = 1 / 3.6;

export type UnitSystem = 'imperial' | 'metric';

export function metersToMiles(m: number): number {
	return m / M_PER_MI;
}
export function metersToKm(m: number): number {
	return m / 1000;
}
export function metersToFeet(m: number): number {
	return m / M_PER_FT;
}
export function mpsToMph(v: number): number {
	return v / MPS_PER_MPH;
}
export function mpsToKmh(v: number): number {
	return v * 3.6;
}
export function secondsToHours(s: number): number {
	return s / 3600;
}

export function fmtDistance(m: number, system: UnitSystem = 'imperial'): string {
	const v = system === 'imperial' ? metersToMiles(m) : metersToKm(m);
	const unit = system === 'imperial' ? 'mi' : 'km';
	return `${v.toFixed(1)} ${unit}`;
}

export function fmtElevation(m: number, system: UnitSystem = 'imperial'): string {
	const v = system === 'imperial' ? metersToFeet(m) : m;
	const unit = system === 'imperial' ? 'ft' : 'm';
	return `${Math.round(v).toLocaleString()} ${unit}`;
}

export function fmtSpeed(mps: number, system: UnitSystem = 'imperial'): string {
	const v = system === 'imperial' ? mpsToMph(mps) : mpsToKmh(mps);
	const unit = system === 'imperial' ? 'mph' : 'km/h';
	return `${v.toFixed(1)} ${unit}`;
}

export function fmtDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h === 0) return `${m}m`;
	return `${h}h ${m.toString().padStart(2, '0')}m`;
}
