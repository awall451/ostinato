import type { PageServerLoad } from './$types';
import { getSyncState } from '$lib/server/repos/sync-state';
import { sql } from 'drizzle-orm';
import { activities } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const parentData = await parent();
	const sync = getSyncState(locals.db);
	const totalActivities = locals.db
		.select({ c: sql<number>`count(*)` })
		.from(activities)
		.all()[0].c;
	const needsDetail = locals.db
		.select({ c: sql<number>`count(*)` })
		.from(activities)
		.where(sql`${activities.detail_fetched_at} IS NULL`)
		.all()[0].c;
	return {
		connected: parentData.connected,
		sync,
		totalActivities,
		needsDetail
	};
};
