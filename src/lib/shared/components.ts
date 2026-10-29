/** Component kinds, wear defaults, and pure helpers for the bike Components tab. */

export type ComponentKind = {
	value: string;
	label: string;
	/** Suggested replacement interval in miles; null = no wear tracking by default. */
	defaultWearMi: number | null;
	/** Whether trainer / VirtualRide miles wear this part by default. */
	defaultCountTrainer: boolean;
};

// Wear defaults are rough rules of thumb — prefilled in the form, always editable.
export const COMPONENT_KINDS: ComponentKind[] = [
	{ value: 'chain', label: 'Chain', defaultWearMi: 2000, defaultCountTrainer: true },
	{ value: 'cassette', label: 'Cassette', defaultWearMi: 6000, defaultCountTrainer: true },
	{ value: 'chainring', label: 'Chainring', defaultWearMi: 10000, defaultCountTrainer: true },
	{ value: 'tire_front', label: 'Front tire', defaultWearMi: 3000, defaultCountTrainer: false },
	{ value: 'tire_rear', label: 'Rear tire', defaultWearMi: 2000, defaultCountTrainer: false },
	{ value: 'sealant', label: 'Tire sealant', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'brake_pads', label: 'Brake pads', defaultWearMi: 1000, defaultCountTrainer: false },
	{ value: 'rotors', label: 'Rotors', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'crankset', label: 'Crankset', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'bottom_bracket', label: 'Bottom bracket', defaultWearMi: 5000, defaultCountTrainer: true },
	{ value: 'derailleur_rear', label: 'Rear derailleur', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'derailleur_front', label: 'Front derailleur', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'shifters', label: 'Shifters', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'cables', label: 'Cables / housing', defaultWearMi: 3000, defaultCountTrainer: true },
	{ value: 'wheelset', label: 'Wheelset', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'wheel_front', label: 'Front wheel', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'wheel_rear', label: 'Rear wheel', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'fork', label: 'Fork', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'shock', label: 'Shock', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'dropper', label: 'Dropper post', defaultWearMi: null, defaultCountTrainer: false },
	{ value: 'pedals', label: 'Pedals', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'power_meter', label: 'Power meter', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'saddle', label: 'Saddle', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'handlebar', label: 'Handlebar', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'stem', label: 'Stem', defaultWearMi: null, defaultCountTrainer: true },
	{ value: 'bar_tape', label: 'Bar tape / grips', defaultWearMi: 3000, defaultCountTrainer: true },
	{ value: 'other', label: 'Other', defaultWearMi: null, defaultCountTrainer: true }
];

const BY_VALUE = new Map(COMPONENT_KINDS.map((k) => [k.value, k]));

export function componentKind(value: string): ComponentKind {
	return BY_VALUE.get(value) ?? { value, label: value, defaultWearMi: null, defaultCountTrainer: true };
}

export type WearLevel = 'none' | 'ok' | 'warn' | 'due';

export type WearStatus = { level: WearLevel; pct: number | null };

export const WEAR_WARN_PCT = 0.8;

/** ok < 80% ≤ warn < 100% ≤ due. No limit → 'none'. */
export function wearStatus(distance_m: number, limit_m: number | null): WearStatus {
	if (!limit_m || limit_m <= 0) return { level: 'none', pct: null };
	const pct = distance_m / limit_m;
	const level: WearLevel = pct >= 1 ? 'due' : pct >= WEAR_WARN_PCT ? 'warn' : 'ok';
	return { level, pct };
}

/** `YYYY-MM-DD` (date input) → epoch seconds at UTC midnight. Comparable to `start_date_local`. */
export function dateInputToEpoch(s: string): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return null;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const ms = Date.UTC(y, mo - 1, d);
	const back = new Date(ms);
	if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
	return ms / 1000;
}

/** Epoch seconds → `YYYY-MM-DD` (UTC). */
export function epochToDateInput(epoch: number): string {
	return new Date(epoch * 1000).toISOString().slice(0, 10);
}
