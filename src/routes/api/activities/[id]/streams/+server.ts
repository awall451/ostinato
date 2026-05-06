import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StravaClient } from '$lib/server/strava/client';
import { enrichStreams } from '$lib/server/strava/sync';
import { readSecrets } from '$lib/server/strava/secrets';
import { StravaAuthError, StravaRateLimitError } from '$lib/server/strava/types';

export const POST: RequestHandler = async ({ locals, params }) => {
	const secrets = readSecrets();
	if (!secrets) throw error(401, 'not connected');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid activity id');
	const client = new StravaClient(locals.db);
	try {
		const result = await enrichStreams(client, locals.db, id);
		if (!result.enriched) throw error(404, 'activity not found');
		return json(result);
	} catch (e) {
		if (e instanceof StravaAuthError) throw error(401, e.message);
		if (e instanceof StravaRateLimitError) throw error(429, e.message);
		throw e;
	}
};
