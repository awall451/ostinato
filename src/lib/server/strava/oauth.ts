import { env } from '$env/dynamic/private';
import type { StravaTokenResponse } from './types';

const AUTH_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const SCOPES = 'read,activity:read_all,profile:read_all';

function clientId(): string {
	const id = env.STRAVA_CLIENT_ID;
	if (!id) throw new Error('STRAVA_CLIENT_ID not set');
	return id;
}

function clientSecret(): string {
	const s = env.STRAVA_CLIENT_SECRET;
	if (!s) throw new Error('STRAVA_CLIENT_SECRET not set');
	return s;
}

export function redirectUri(): string {
	return env.STRAVA_REDIRECT_URI ?? 'http://localhost:5173/auth/callback';
}

export function buildAuthorizeUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: clientId(),
		redirect_uri: redirectUri(),
		response_type: 'code',
		approval_prompt: 'auto',
		scope: SCOPES,
		state
	});
	return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
	const body = new URLSearchParams({
		client_id: clientId(),
		client_secret: clientSecret(),
		code,
		grant_type: 'authorization_code'
	});
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) {
		throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as StravaTokenResponse;
}

export async function refreshTokens(refreshToken: string): Promise<StravaTokenResponse> {
	const body = new URLSearchParams({
		client_id: clientId(),
		client_secret: clientSecret(),
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	});
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) {
		throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as StravaTokenResponse;
}
