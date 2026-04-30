import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSecrets } from '$lib/server/strava/secrets';

export const POST: RequestHandler = async () => {
	clearSecrets();
	throw redirect(303, '/settings');
};
