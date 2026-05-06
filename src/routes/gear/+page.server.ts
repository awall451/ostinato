import type { PageServerLoad } from './$types';
import {
	listGear,
	totalsByGear,
	deletedBikeTotals,
	type GearTotals,
	type DeletedBikeTotals
} from '$lib/server/repos/gear';
import type { Gear } from '$lib/server/db/schema';

export type GearWithTotals = Gear & { totals: GearTotals | null };

export const load: PageServerLoad = async ({ locals, url }) => {
	const includeRetired = url.searchParams.get('retired') === '1';
	// Bikes: always include retired so client-side color map keyed by sorted-id
	// position stays stable when the retired toggle flips. Visibility is decided
	// client-side via includeRetired.
	const allBikesRaw = listGear(locals.db, { includeRetired: true, kind: 'bike' });
	const shoesRaw = listGear(locals.db, { includeRetired, kind: 'shoe' });
	const totalsRows = totalsByGear(locals.db);
	const totalsById = new Map(totalsRows.map((t) => [t.gear_id, t]));

	const allBikes: GearWithTotals[] = allBikesRaw.map((g) => ({
		...g,
		totals: totalsById.get(g.id) ?? null
	}));
	const shoes: GearWithTotals[] = shoesRaw.map((g) => ({
		...g,
		totals: totalsById.get(g.id) ?? null
	}));

	const deletedBikes: DeletedBikeTotals[] = includeRetired ? deletedBikeTotals(locals.db) : [];
	return { allBikes, shoes, deletedBikes, includeRetired };
};
