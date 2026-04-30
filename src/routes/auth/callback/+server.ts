import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCode } from '$lib/server/strava/oauth';
import { writeSecrets } from '$lib/server/strava/secrets';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errParam = url.searchParams.get('error');
	if (errParam) throw error(400, `Strava authorization denied: ${errParam}`);
	if (!code) throw error(400, 'missing code');

	const expected = cookies.get('strava_oauth_state');
	if (!expected || expected !== state) {
		throw error(400, 'OAuth state mismatch');
	}
	cookies.delete('strava_oauth_state', { path: '/' });

	const tok = await exchangeCode(code);
	if (!tok.athlete) throw error(500, 'no athlete in token response');

	writeSecrets({
		athlete_id: tok.athlete.id,
		access_token: tok.access_token,
		refresh_token: tok.refresh_token,
		expires_at: tok.expires_at,
		scope: tok.scope ?? 'read,activity:read_all,profile:read_all',
		connected_at: Math.floor(Date.now() / 1000)
	});

	throw redirect(302, '/settings?connected=1');
};
