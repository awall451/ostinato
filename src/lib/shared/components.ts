/** Component kinds, wear defaults, and pure helpers for the bike Components tab. */

export type ComponentKind = {
	value: string;
	label: string;
	/** Suggested replacement interval in miles; null = no wear tracking by default. */
	defaultWearMi: number | null;
	/** Whether trainer / VirtualRide miles wear this part by default. */
	defaultCountTrainer: boolean;
};

export const COMPONENT_KINDS: ComponentKind[] = [];

export function componentKind(value: string): ComponentKind {
	return { value, label: value, defaultWearMi: null, defaultCountTrainer: true };
}

export type WearLevel = 'none' | 'ok' | 'warn' | 'due';

export type WearStatus = { level: WearLevel; pct: number | null };

/** ok < 80% ≤ warn < 100% ≤ due. No limit → 'none'. */
export function wearStatus(_distance_m: number, _limit_m: number | null): WearStatus {
	return { level: 'none', pct: null };
}

/** `YYYY-MM-DD` (date input) → epoch seconds at UTC midnight. Comparable to `start_date_local`. */
export function dateInputToEpoch(_s: string): number | null {
	return null;
}

/** Epoch seconds → `YYYY-MM-DD` (UTC). */
export function epochToDateInput(_epoch: number): string {
	return '';
}
