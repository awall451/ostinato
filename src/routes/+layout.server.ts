import type { LayoutServerLoad } from './$types';
import { getSyncState } from '$lib/server/repos/sync-state';
import { hasSecrets } from '$lib/server/strava/secrets';

export const load: LayoutServerLoad = async ({ locals }) => {
	const sync = getSyncState(locals.db);
	return {
		connected: hasSecrets(),
		lastSyncedAt: sync?.last_synced_at ?? null
	};
};
