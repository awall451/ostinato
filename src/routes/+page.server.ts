import type { PageServerLoad } from './$types';
import { listActivitiesInRange } from '$lib/server/repos/activities';
import { listGear } from '$lib/server/repos/gear';
import { daysAgoSec, nowSec } from '$lib/shared/time';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const parentData = await parent();
	const days = Number(url.searchParams.get('days') ?? 365);
	const startEpoch = daysAgoSec(days);
	const endEpoch = nowSec();
	const activities = listActivitiesInRange(locals.db, { startEpoch, endEpoch });
	const gear = listGear(locals.db, { includeRetired: true });
	return {
		activities,
		gear,
		rangeDays: days,
		startEpoch,
		endEpoch,
		connected: parentData.connected
	};
};
