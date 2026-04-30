import { isoWeek, monthKey, yearKey, type Bucket } from './time';

const DAY = 86400;

/**
 * Returns a dense, monotonically-increasing array of bucket keys covering
 * [startEpoch, endEpoch] inclusive — including periods that contain no
 * activities. The chart's x-axis spans the full selected range regardless
 * of activity sparsity.
 *
 * All math is UTC-anchored to dodge DST.
 */
export function bucketGrid(startEpoch: number, endEpoch: number, bucket: Bucket): string[] {
	if (endEpoch < startEpoch) return [];

	if (bucket === 'week') return weekKeys(startEpoch, endEpoch);
	if (bucket === 'month') return monthKeys(startEpoch, endEpoch);
	return yearKeys(startEpoch, endEpoch);
}

function weekKeys(startEpoch: number, endEpoch: number): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	let t = startEpoch;
	out.push(isoWeek(t));
	seen.add(out[0]);
	while (t <= endEpoch) {
		const k = isoWeek(t);
		if (!seen.has(k)) {
			out.push(k);
			seen.add(k);
		}
		t += DAY;
	}
	const endKey = isoWeek(endEpoch);
	if (!seen.has(endKey)) out.push(endKey);
	return out;
}

function monthKeys(startEpoch: number, endEpoch: number): string[] {
	const start = new Date(startEpoch * 1000);
	const end = new Date(endEpoch * 1000);
	const out: string[] = [];
	let y = start.getUTCFullYear();
	let m = start.getUTCMonth();
	const endY = end.getUTCFullYear();
	const endM = end.getUTCMonth();
	while (y < endY || (y === endY && m <= endM)) {
		out.push(monthKey(Math.floor(Date.UTC(y, m, 1) / 1000)));
		m += 1;
		if (m > 11) {
			m = 0;
			y += 1;
		}
	}
	return out;
}

function yearKeys(startEpoch: number, endEpoch: number): string[] {
	const startY = new Date(startEpoch * 1000).getUTCFullYear();
	const endY = new Date(endEpoch * 1000).getUTCFullYear();
	const out: string[] = [];
	for (let y = startY; y <= endY; y++) {
		out.push(yearKey(Math.floor(Date.UTC(y, 0, 1) / 1000)));
	}
	return out;
}
