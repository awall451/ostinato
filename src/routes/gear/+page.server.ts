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
	const allGear = listGear(locals.db, { includeRetired });
	const totalsRows = totalsByGear(locals.db);
	const totalsByid = new Map(totalsRows.map((t) => [t.gear_id, t]));

	const enriched: GearWithTotals[] = allGear.map((g) => ({
		...g,
		totals: totalsByid.get(g.id) ?? null
	}));

	const bikes = enriched.filter((g) => g.kind === 'bike');
	const shoes = enriched.filter((g) => g.kind === 'shoe');
	const deletedBikes: DeletedBikeTotals[] = includeRetired ? deletedBikeTotals(locals.db) : [];
	return { bikes, shoes, deletedBikes, includeRetired };
};
