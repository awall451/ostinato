import { M_PER_MI } from '$lib/shared/units';
import { dateInputToEpoch } from '$lib/shared/components';
import type { ComponentFields } from '$lib/server/repos/components';

/**
 * Form boundary for the Components tab: display units (miles, dollars,
 * YYYY-MM-DD) in, storage units (meters, cents, epoch seconds) out.
 */

function str(fd: FormData, k: string): string | null {
	const v = fd.get(k);
	if (typeof v !== 'string') return null;
	const t = v.trim();
	return t === '' ? null : t;
}

function num(fd: FormData, k: string): number | null {
	const s = str(fd, k);
	if (s === null) return null;
	const n = Number(s.replace(/[$,]/g, ''));
	return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseComponentFields(fd: FormData): ComponentFields | { error: string } {
	const kind = str(fd, 'kind');
	if (!kind) return { error: 'kind is required' };
	const wearMi = num(fd, 'wear_limit_mi');
	const startMi = num(fd, 'starting_mi');
	const price = num(fd, 'price');
	const purchased = str(fd, 'purchased_at');
	return {
		kind,
		brand: str(fd, 'brand'),
		model: str(fd, 'model'),
		notes: str(fd, 'notes'),
		wear_limit_m: wearMi !== null && wearMi > 0 ? wearMi * M_PER_MI : null,
		starting_distance_m: startMi !== null ? startMi * M_PER_MI : 0,
		purchase_price_cents: price !== null ? Math.round(price * 100) : null,
		purchased_at: purchased ? dateInputToEpoch(purchased) : null,
		count_trainer: fd.get('count_trainer') ? 1 : 0
	};
}

export function parseDate(fd: FormData, k: string): number | { error: string } {
	const s = str(fd, k);
	const e = s ? dateInputToEpoch(s) : null;
	return e === null ? { error: `${k} must be a date (YYYY-MM-DD)` } : e;
}

export function parseId(fd: FormData, k = 'id'): number | null {
	const n = Number(fd.get(k));
	return Number.isInteger(n) && n > 0 ? n : null;
}
