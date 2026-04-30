import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAuthorizeUrl } from '$lib/server/strava/oauth';
import { randomBytes } from 'node:crypto';

export const GET: RequestHandler = async ({ cookies }) => {
	const state = randomBytes(16).toString('hex');
	cookies.set('strava_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 600
	});
	throw redirect(302, buildAuthorizeUrl(state));
};
