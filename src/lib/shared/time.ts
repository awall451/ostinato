/** Time bucketing helpers — input epoch seconds, output bucket key strings. */

export type Bucket = 'week' | 'month' | 'year';

/** ISO week key like 2026-W17. */
export function isoWeek(epochSec: number): string {
	const d = new Date(epochSec * 1000);
	// Copy date to UTC noon to avoid TZ edge cases
	const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
	target.setUTCDate(target.getUTCDate() - dayNum + 3);
	const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
	const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
	return `${target.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}

export function monthKey(epochSec: number): string {
	const d = new Date(epochSec * 1000);
	return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
}

export function yearKey(epochSec: number): string {
	return new Date(epochSec * 1000).getUTCFullYear().toString();
}

export function bucketKey(epochSec: number, bucket: Bucket): string {
	if (bucket === 'week') return isoWeek(epochSec);
	if (bucket === 'month') return monthKey(epochSec);
	return yearKey(epochSec);
}

export function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

export function daysAgoSec(n: number): number {
	return nowSec() - n * 86400;
}
