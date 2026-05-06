import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getGearById, totalsByGear } from '$lib/server/repos/gear';
import { listActivitiesForGear } from '$lib/server/repos/activities';

export const load: PageServerLoad = async ({ locals, params }) => {
	const gear = getGearById(locals.db, params.id);
	if (!gear) throw error(404, 'gear not found');
	const totals = totalsByGear(locals.db).find((t) => t.gear_id === gear.id) ?? null;
	const activities = listActivitiesForGear(locals.db, gear.id, 1000);
	return { gear, totals, activities };
};
