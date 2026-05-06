import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getActivityById } from '$lib/server/repos/activities';
import { getGearById } from '$lib/server/repos/gear';
import { athletes } from '$lib/server/db/schema';
import { parseDescription, parseSplits, parseSegmentEfforts } from '$lib/shared/activity-detail';

export const load: PageServerLoad = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(404, 'activity not found');
	const activity = getActivityById(locals.db, id);
	if (!activity) throw error(404, 'activity not found');
	const gear = activity.gear_id ? getGearById(locals.db, activity.gear_id) : null;

	// Athlete measurement preference drives splits unit (mi vs km).
	const athleteRow = locals.db.select().from(athletes).all()[0];
	const measurement: 'imperial' | 'metric' = athleteRow?.measurement === 'metric' ? 'metric' : 'imperial';

	let description: string | null = null;
	let splits: ReturnType<typeof parseSplits> = [];
	let segments: ReturnType<typeof parseSegmentEfforts> = [];
	if (activity.raw_detail_json) {
		try {
			const detail = JSON.parse(activity.raw_detail_json) as Record<string, unknown>;
			description = parseDescription(detail);
			splits = parseSplits(detail, measurement);
			segments = parseSegmentEfforts(detail);
		} catch {
			// Malformed JSON — leave detail-only sections empty rather than 500.
		}
	}

	return { activity, gear, measurement, description, splits, segments };
};
