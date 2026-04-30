import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedFixtures } from '$lib/server/seed';

/** DEV-only fixture loader. Wipes the DB and inserts ~150 synthetic activities. */
export const POST: RequestHandler = async ({ locals, url }) => {
	if (process.env.NODE_ENV === 'production') {
		throw error(403, 'fixture endpoint disabled in production');
	}
	const count = Number(url.searchParams.get('count') ?? 150);
	const seed = Number(url.searchParams.get('seed') ?? 42);
	const report = seedFixtures(locals.db, { count, seed });
	return json(report);
};
