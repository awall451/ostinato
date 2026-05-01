import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { recordRateLimit, recordError, clearError } from '../repos/sync-state';
import { readSecrets, writeSecrets } from './secrets';
import { refreshTokens } from './oauth';
import {
	StravaAuthError,
	StravaRateLimitError,
	type StravaAthlete,
	type StravaSummaryActivity,
	type StravaDetailedActivity,
	type StravaGearDetailed
} from './types';

type DB = BetterSQLite3Database<typeof schema>;

const API_BASE = 'https://www.strava.com/api/v3';

export class StravaClient {
	constructor(private db: DB) {}

	private async accessToken(): Promise<string> {
		const s = readSecrets();
		if (!s) throw new StravaAuthError('not connected — run /auth/connect');
		const now = Math.floor(Date.now() / 1000);
		if (s.expires_at - now < 60) {
			const fresh = await refreshTokens(s.refresh_token);
			writeSecrets({
				athlete_id: s.athlete_id,
				access_token: fresh.access_token,
				refresh_token: fresh.refresh_token,
				expires_at: fresh.expires_at,
				scope: s.scope,
				connected_at: s.connected_at
			});
			return fresh.access_token;
		}
		return s.access_token;
	}

	private parseRateLimit(headers: Headers): void {
		const usage = headers.get('x-ratelimit-usage');
		const limit = headers.get('x-ratelimit-limit');
		if (!usage || !limit) return;
		const [u15, uDay] = usage.split(',').map((s) => parseInt(s, 10));
		const [l15, lDay] = limit.split(',').map((s) => parseInt(s, 10));
		if ([u15, uDay, l15, lDay].some((n) => Number.isNaN(n))) return;
		recordRateLimit(
			this.db,
			{ used15: u15, limit15: l15, usedDay: uDay, limitDay: lDay },
			Math.floor(Date.now() / 1000)
		);
	}

	async request<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
		const token = await this.accessToken();
		const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
		const res = await fetch(url, {
			...init,
			headers: {
				...(init?.headers ?? {}),
				Authorization: `Bearer ${token}`
			}
		});

		this.parseRateLimit(res.headers);

		if (res.status === 401) {
			if (_retried) {
				recordError(this.db, '401 after refresh — reconnect required', Math.floor(Date.now() / 1000));
				throw new StravaAuthError('Strava re-auth required');
			}
			// Force a refresh by zeroing expires_at, then retry once.
			const s = readSecrets();
			if (s) writeSecrets({ ...s, expires_at: 0 });
			return this.request<T>(path, init, true);
		}
		if (res.status === 429) {
			const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
			recordError(this.db, `rate limited (retry after ${retryAfter}s)`, Math.floor(Date.now() / 1000));
			throw new StravaRateLimitError('Strava rate limit hit', retryAfter);
		}
		if (!res.ok) {
			const body = await res.text();
			recordError(this.db, `${res.status}: ${body.slice(0, 300)}`, Math.floor(Date.now() / 1000));
			throw new Error(`Strava ${res.status}: ${body}`);
		}
		clearError(this.db);
		return (await res.json()) as T;
	}

	getAthlete(): Promise<StravaAthlete> {
		return this.request<StravaAthlete>('/athlete');
	}

	listActivities(opts: { after?: number; before?: number; page?: number; perPage?: number }): Promise<StravaSummaryActivity[]> {
		const p = new URLSearchParams();
		if (opts.after !== undefined) p.set('after', String(opts.after));
		if (opts.before !== undefined) p.set('before', String(opts.before));
		p.set('page', String(opts.page ?? 1));
		p.set('per_page', String(opts.perPage ?? 200));
		return this.request<StravaSummaryActivity[]>(`/athlete/activities?${p.toString()}`);
	}

	getActivity(id: number): Promise<StravaDetailedActivity> {
		return this.request<StravaDetailedActivity>(`/activities/${id}`);
	}

	getGear(id: string): Promise<StravaGearDetailed> {
		return this.request<StravaGearDetailed>(`/gear/${id}`);
	}
}
