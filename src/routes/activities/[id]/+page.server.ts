import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getActivityById } from '$lib/server/repos/activities';
import { getGearById } from '$lib/server/repos/gear';

export const load: PageServerLoad = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(404, 'activity not found');
	const activity = getActivityById(locals.db, id);
	if (!activity) throw error(404, 'activity not found');
	const gear = activity.gear_id ? getGearById(locals.db, activity.gear_id) : null;
	return { activity, gear };
};
