import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StravaClient } from '$lib/server/strava/client';
import { syncIncremental, syncGearAndAthlete } from '$lib/server/strava/sync';
import { readSecrets } from '$lib/server/strava/secrets';
import { StravaAuthError, StravaRateLimitError } from '$lib/server/strava/types';

export const POST: RequestHandler = async ({ locals }) => {
	const secrets = readSecrets();
	if (!secrets) throw error(401, 'not connected');
	const client = new StravaClient(locals.db);
	try {
		const gear = await syncGearAndAthlete(client, locals.db);
		const summaries = await syncIncremental(client, locals.db, secrets.athlete_id);
		return json({ gear, summaries });
	} catch (e) {
		if (e instanceof StravaAuthError) throw error(401, e.message);
		if (e instanceof StravaRateLimitError) throw error(429, e.message);
		throw error(500, (e as Error).message);
	}
};
