import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { getGearById, totalsByGear } from '$lib/server/repos/gear';
import { listActivitiesForGear } from '$lib/server/repos/activities';
import {
	ComponentError,
	addComponent,
	deleteComponent,
	installComponent,
	listComponentsForGear,
	listSpares,
	removeComponent,
	swapComponent,
	updateComponent
} from '$lib/server/repos/components';
import { parseComponentFields, parseDate, parseId } from '$lib/server/forms/component-form';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const gear = getGearById(locals.db, params.id);
	if (!gear) throw error(404, 'gear not found');
	const totals = totalsByGear(locals.db).find((t) => t.gear_id === gear.id) ?? null;
	const activities = listActivitiesForGear(locals.db, gear.id, 1000);
	const tab = url.searchParams.get('tab') === 'components' && gear.kind === 'bike' ? 'components' : 'overview';
	const parts = gear.kind === 'bike' ? listComponentsForGear(locals.db, gear.id) : { installed: [], history: [] };
	const spares = gear.kind === 'bike' ? listSpares(locals.db, gear.athlete_id) : [];
	return { gear, totals, activities, tab, parts, spares };
};

/** Run a repo mutation; ComponentError → 400 with the message, anything else rethrows. */
function attempt(fn: () => void) {
	try {
		fn();
		return { ok: true };
	} catch (e) {
		if (e instanceof ComponentError) return fail(400, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	add: async ({ locals, params, request }) => {
		const fd = await request.formData();
		const fields = parseComponentFields(fd);
		if ('error' in fields) return fail(400, { error: fields.error });
		const at = parseDate(fd, 'installed_at');
		if (typeof at !== 'number') return fail(400, at);
		return attempt(() => void addComponent(locals.db, params.id, at, fields));
	},

	installSpare: async ({ locals, params, request }) => {
		const fd = await request.formData();
		const id = parseId(fd);
		const at = parseDate(fd, 'installed_at');
		if (id === null) return fail(400, { error: 'pick a part' });
		if (typeof at !== 'number') return fail(400, at);
		return attempt(() => installComponent(locals.db, id, params.id, at));
	},

	swap: async ({ locals, request }) => {
		const fd = await request.formData();
		const id = parseId(fd);
		if (id === null) return fail(400, { error: 'missing id' });
		const fields = parseComponentFields(fd);
		if ('error' in fields) return fail(400, { error: fields.error });
		const at = parseDate(fd, 'at');
		if (typeof at !== 'number') return fail(400, at);
		return attempt(() => void swapComponent(locals.db, id, at, fields));
	},

	remove: async ({ locals, request }) => {
		const fd = await request.formData();
		const id = parseId(fd);
		if (id === null) return fail(400, { error: 'missing id' });
		const at = parseDate(fd, 'at');
		if (typeof at !== 'number') return fail(400, at);
		return attempt(() => removeComponent(locals.db, id, at, { retire: !fd.get('keep_spare') }));
	},

	update: async ({ locals, request }) => {
		const fd = await request.formData();
		const id = parseId(fd);
		if (id === null) return fail(400, { error: 'missing id' });
		const fields = parseComponentFields(fd);
		if ('error' in fields) return fail(400, { error: fields.error });
		return attempt(() => updateComponent(locals.db, id, fields));
	},

	delete: async ({ locals, request }) => {
		const fd = await request.formData();
		const id = parseId(fd);
		if (id === null) return fail(400, { error: 'missing id' });
		return attempt(() => deleteComponent(locals.db, id));
	}
};
