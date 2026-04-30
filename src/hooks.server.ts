import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const { db, raw } = getDb();
	event.locals.db = db;
	event.locals.rawDb = raw;
	return resolve(event);
};
