import { pc } from './palette';

// Stable per-gear color: index by position in the *full* sorted bike list.
// Caller is responsible for passing the same id list (e.g. all bikes including
// retired ones) so colors do not shift when a UI filter hides some entries.
export function colorByGearId(bikeIdsSorted: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (let i = 0; i < bikeIdsSorted.length; i++) {
		out[bikeIdsSorted[i]] = pc(i);
	}
	return out;
}
