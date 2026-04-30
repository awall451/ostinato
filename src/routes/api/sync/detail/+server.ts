import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StravaClient } from '$lib/server/strava/client';
import { enrichDetail } from '$lib/server/strava/sync';
import { readSecrets } from '$lib/server/strava/secrets';
import { StravaAuthError, StravaRateLimitError } from '$lib/server/strava/types';

export const POST: RequestHandler = async ({ locals, url }) => {
	const secrets = readSecrets();
	if (!secrets) throw error(401, 'not connected');
	const limit = Math.min(Number(url.searchParams.get('limit') ?? 25), 100);
	const client = new StravaClient(locals.db);
	try {
		const result = await enrichDetail(client, locals.db, limit);
		return json(result);
	} catch (e) {
		if (e instanceof StravaAuthError) throw error(401, e.message);
		if (e instanceof StravaRateLimitError) throw error(429, e.message);
		throw error(500, (e as Error).message);
	}
};
